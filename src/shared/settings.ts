export type AiProvider = 'openai' | 'anthropic';

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
