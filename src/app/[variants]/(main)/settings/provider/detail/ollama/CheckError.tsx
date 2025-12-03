import { ChatMessageError } from '@lobechat/types';
import { Skeleton } from 'antd';
import dynamic from 'next/dynamic';
import { ReactNode } from 'react';
import debug from 'debug';

import Container from './Container';

const log = debug('lobe-client:OllamaCheckError');

const loading = () => <Skeleton active style={{ width: 400 }} />;

const OllamaSetupGuide = dynamic(() => import('@/features/OllamaSetupGuide'), {
  loading,
  ssr: false,
});

const InvalidModel = dynamic(() => import('@/features/OllamaModelDownloader'), {
  loading,
  ssr: false,
});

interface OllamaError {
  code: string | null;
  message: string;
  param?: any;
  status_code?: number;
  type: string;
}

interface OllamaErrorResponse {
  error: OllamaError;
}

const UNRESOLVED_MODEL_REGEXP = /model ['"]([\w+,-_.]+)['"] not found/;

const CheckError = ({
  defaultError,
  error,
  setError,
}: {
  defaultError: ReactNode;
  error?: ChatMessageError;
  setError: (error?: ChatMessageError) => void;
}) => {
  const errorBody: OllamaErrorResponse = error?.body;

  const errorMessage = errorBody.error?.message;
  const statusCode = errorBody.error?.status_code;

  log('Processing Ollama check error: %O', {
    errorType: error?.type,
    errorMessage,
    statusCode,
    fullError: errorBody,
  });

  if (error?.type === 'OllamaServiceUnavailable') {
    log('Showing OllamaSetupGuide (OllamaServiceUnavailable)');
    return <OllamaSetupGuide />;
  }

  // error of not pull the model
  // Try to match model name from error message
  let unresolvedModel = errorMessage?.match(UNRESOLVED_MODEL_REGEXP)?.[1];
  
  log('Primary regex match result: %s', unresolvedModel || 'no match');

  // If regex doesn't match but status_code is 404 and message contains "not found",
  // try to extract model name from the message (fallback for other formats)
  if (!unresolvedModel && statusCode === 404 && errorMessage?.toLowerCase().includes('not found')) {
    log('Primary regex failed, trying fallback for status_code 404');
    // Try to extract model name even without quotes (e.g., "model qwen2.5 not found")
    const fallbackMatch = errorMessage.match(/model\s+([\w+,-_.]+)\s+not\s+found/i);
    if (fallbackMatch) {
      unresolvedModel = fallbackMatch[1];
      log('Fallback regex matched model: %s', unresolvedModel);
    } else {
      log('Fallback regex also failed to match');
    }
  }

  if (unresolvedModel) {
    log('Showing InvalidModel component for model: %s', unresolvedModel);
    return (
      <Container setError={setError}>
        <InvalidModel model={unresolvedModel} />
      </Container>
    );
  }

  // error of not enable model or not set the CORS rules
  if (errorMessage?.includes('Failed to fetch') || errorMessage?.includes('fetch failed')) {
    log('Showing OllamaSetupGuide (Failed to fetch error)');
    return (
      <Container setError={setError}>
        <OllamaSetupGuide />
      </Container>
    );
  }

  log('Returning defaultError (no specific handler matched)');
  return defaultError;
};

export default CheckError;
