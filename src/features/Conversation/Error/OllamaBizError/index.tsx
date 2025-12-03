import { UIChatMessage } from '@lobechat/types';
import { Skeleton } from 'antd';
import dynamic from 'next/dynamic';
import { memo } from 'react';
import debug from 'debug';

import ErrorJsonViewer from '../ErrorJsonViewer';

const log = debug('lobe-client:OllamaBizError');

const loading = () => <Skeleton active style={{ width: 300 }} />;

const SetupGuide = dynamic(() => import('@/features/OllamaSetupGuide'), { loading, ssr: false });

const InvalidModel = dynamic(() => import('./InvalidOllamaModel'), { loading, ssr: false });

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

const OllamaBizError = memo<UIChatMessage>(({ error, id }) => {
  const errorBody: OllamaErrorResponse = (error as any)?.body;

  const errorMessage = errorBody.error?.message;
  const statusCode = errorBody.error?.status_code;

  log('Processing Ollama error: %O', {
    id,
    errorMessage,
    statusCode,
    errorType: error?.type,
    fullError: errorBody,
  });

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
    return <InvalidModel id={id} model={unresolvedModel} />;
  }

  // error of not enable model or not set the CORS rules
  if (errorMessage?.includes('Failed to fetch')) {
    log('Showing SetupGuide component (Failed to fetch error)');
    return <SetupGuide id={id} />;
  }

  log('Showing ErrorJsonViewer (no specific handler matched)');
  return <ErrorJsonViewer error={error} id={id} />;
});

export default OllamaBizError;
