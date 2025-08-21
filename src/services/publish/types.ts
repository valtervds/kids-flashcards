// Tipos para o serviço de publicação
export interface PublishProgress {
  stage: 'init' | 'auth' | 'deck' | 'audio' | 'video' | 'complete' | 'error' | 'initializing';
  message: string;
  progress: number; // 0-100
  timestamp: number;
}

export interface PublishResult {
  success: boolean;
  cloudId?: string;
  error?: string;
  logs: PublishProgress[];
}

export interface PublishOptions {
  forceReauth?: boolean;
  skipAudio?: boolean;
  skipVideo?: boolean;
  onProgress?: PublishEventCallback;
}

export type PublishEventCallback = (progress: PublishProgress) => void;
