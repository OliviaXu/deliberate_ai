export type SubmitSource = 'enter_key' | 'send_button';

export interface SubmitSignal {
  source: SubmitSource;
  timestamp: number;
  url: string;
  platform: 'gemini';
  hasPromptInput: boolean;
}

export type LogLevel = 'off' | 'error' | 'info' | 'debug';

export interface DebugConfig {
  enabled: boolean;
  level: LogLevel;
}

export type Unsubscribe = () => void;
