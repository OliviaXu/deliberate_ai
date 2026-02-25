export type SubmitSource = 'enter_key' | 'send_button';
export type InteractionMode = 'delegation' | 'problem_solving' | 'learning';

export interface SubmitSignal {
  source: SubmitSource;
  timestamp: number;
  url: string;
  platform: 'gemini';
  hasPromptInput: boolean;
}

export interface InterceptedSubmitIntent extends SubmitSignal {
  interceptionId: number;
}

export type LogLevel = 'off' | 'error' | 'info' | 'debug';

export interface DebugConfig {
  enabled: boolean;
  level: LogLevel;
}

export type Unsubscribe = () => void;
