export type AiProvider = 'openai' | 'anthropic';

export type AutoApprovalThreshold = 'low' | 'medium' | 'high';

export type AppSettings = {
  defaultModel: 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5';
  autoApprovalEnabled: boolean;
  autoApprovalThreshold: AutoApprovalThreshold;
  showPlanPanel: boolean;
};

export type GetAppSettingsResponse = {
  settings: AppSettings;
};

export type UpdateAppSettingsRequest = {
  settings: Partial<AppSettings>;
};

export type UpdateAppSettingsResponse = {
  settings: AppSettings;
};

export type GetAiKeysResponse = {
  keys: Array<{ provider: AiProvider; configured: boolean }>;
};

export type SetAiKeyRequest = {
  provider: AiProvider;
  apiKey: string;
};

export type SetAiKeyResponse = {
  provider: AiProvider;
  configured: boolean;
};

export type ClearAiKeyRequest = {
  provider: AiProvider;
};

export type ClearAiKeyResponse = {
  provider: AiProvider;
  configured: boolean;
};
