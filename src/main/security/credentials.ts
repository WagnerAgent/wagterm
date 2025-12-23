import keytar from 'keytar';
import type { AiProvider } from '../../shared/settings';

const SERVICE_NAME = 'wagterm';

const accountForProvider = (provider: AiProvider) => `${provider}:apiKey`;

export const getAiKey = (provider: AiProvider) =>
  keytar.getPassword(SERVICE_NAME, accountForProvider(provider));

export const setAiKey = (provider: AiProvider, apiKey: string) =>
  keytar.setPassword(SERVICE_NAME, accountForProvider(provider), apiKey);

export const clearAiKey = (provider: AiProvider) =>
  keytar.deletePassword(SERVICE_NAME, accountForProvider(provider));
