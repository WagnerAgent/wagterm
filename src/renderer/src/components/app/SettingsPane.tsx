import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useSettingsContext } from '../../context/SettingsContext';

type AiProvider = 'openai' | 'anthropic';
type SettingsCategory =
  | 'overview'
  | 'ai-providers'
  | 'ai-defaults'
  | 'host-key-policy'
  | 'session-defaults'
  | 'security'
  | 'tooling';

const SettingsPane = () => {
  const { settings, updateSettings } = useSettingsContext();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('overview');
  const [aiKeyInputs, setAiKeyInputs] = useState<Record<AiProvider, string>>({
    openai: '',
    anthropic: ''
  });
  const [aiKeyStatus, setAiKeyStatus] = useState<
    Record<AiProvider, { configured: boolean; error: string }>
  >({
    openai: { configured: false, error: '' },
    anthropic: { configured: false, error: '' }
  });

  useEffect(() => {
    const loadKeys = async () => {
      const response = await window.wagterm.settings.getAiKeys();
      setAiKeyStatus((prev) => {
        const next = { ...prev };
        for (const key of response.keys) {
          next[key.provider] = { configured: key.configured, error: '' };
        }
        return next;
      });
    };
    void loadKeys();
  }, []);

  const handleSaveKey = async (provider: AiProvider) => {
    const value = aiKeyInputs[provider].trim();
    if (!value) {
      setAiKeyStatus((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], error: 'API key is required.' }
      }));
      return;
    }
    try {
      await window.wagterm.settings.setAiKey({ provider, apiKey: value });
      setAiKeyStatus((prev) => ({
        ...prev,
        [provider]: { configured: true, error: '' }
      }));
      setAiKeyInputs((prev) => ({ ...prev, [provider]: '' }));
    } catch (error) {
      setAiKeyStatus((prev) => ({
        ...prev,
        [provider]: {
          configured: prev[provider].configured,
          error: error instanceof Error ? error.message : 'Failed to save key.'
        }
      }));
    }
  };

  const handleClearKey = async (provider: AiProvider) => {
    try {
      await window.wagterm.settings.clearAiKey({ provider });
      setAiKeyStatus((prev) => ({
        ...prev,
        [provider]: { configured: false, error: '' }
      }));
    } catch (error) {
      setAiKeyStatus((prev) => ({
        ...prev,
        [provider]: {
          configured: prev[provider].configured,
          error: error instanceof Error ? error.message : 'Failed to clear key.'
        }
      }));
    }
  };

  const categories = [
    { id: 'ai-providers' as SettingsCategory, title: 'AI Providers', description: 'Store local API keys for OpenAI and Anthropic.' },
    { id: 'ai-defaults' as SettingsCategory, title: 'AI Defaults', description: 'Default model and agent behaviors for new sessions.' },
    { id: 'host-key-policy' as SettingsCategory, title: 'Host Key Policy', description: 'Choose strict or accept-new behavior for known hosts.' },
    { id: 'session-defaults' as SettingsCategory, title: 'Session Defaults', description: 'Default shell size, fonts, and session timeouts.' },
    { id: 'security' as SettingsCategory, title: 'Security', description: 'Lock screen, local encryption, and audit logs.' },
    { id: 'tooling' as SettingsCategory, title: 'Tooling', description: 'Manage MCP tools and local integrations.' }
  ];

  const renderContent = () => {
    if (activeCategory === 'overview') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className="flex flex-col items-start p-5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left group h-full"
            >
              <h4 className="text-sm font-medium mb-2">{category.title}</h4>
              <p className="text-xs text-muted-foreground flex-1">{category.description}</p>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors mt-3 self-end" />
            </button>
          ))}
        </div>
      );
    }

    if (activeCategory === 'ai-providers') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <Label htmlFor="openai-key" className="text-sm font-medium">OpenAI API Key</Label>
              <span className={`text-xs px-2 py-1 rounded-full ${
                aiKeyStatus.openai.configured
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {aiKeyStatus.openai.configured ? 'Configured' : 'Not set'}
              </span>
            </div>
            <Input
              id="openai-key"
              type="password"
              placeholder={aiKeyStatus.openai.configured ? '••••••••••••••••' : 'sk-...'}
              value={aiKeyInputs.openai}
              onChange={(event) =>
                setAiKeyInputs((prev) => ({ ...prev, openai: event.target.value }))
              }
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveKey('openai')}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleClearKey('openai')}>
                Clear
              </Button>
            </div>
            {aiKeyStatus.openai.error && (
              <p className="text-xs text-destructive">{aiKeyStatus.openai.error}</p>
            )}
          </div>

          <div className="space-y-3 p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <Label htmlFor="anthropic-key" className="text-sm font-medium">Anthropic API Key</Label>
              <span className={`text-xs px-2 py-1 rounded-full ${
                aiKeyStatus.anthropic.configured
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {aiKeyStatus.anthropic.configured ? 'Configured' : 'Not set'}
              </span>
            </div>
            <Input
              id="anthropic-key"
              type="password"
              placeholder={aiKeyStatus.anthropic.configured ? '••••••••••••••••' : 'sk-ant-...'}
              value={aiKeyInputs.anthropic}
              onChange={(event) =>
                setAiKeyInputs((prev) => ({ ...prev, anthropic: event.target.value }))
              }
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveKey('anthropic')}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleClearKey('anthropic')}>
                Clear
              </Button>
            </div>
            {aiKeyStatus.anthropic.error && (
              <p className="text-xs text-destructive">{aiKeyStatus.anthropic.error}</p>
            )}
          </div>
        </div>
      );
    }

    if (activeCategory === 'ai-defaults') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3 p-5 rounded-lg border border-border bg-card">
            <Label htmlFor="default-model" className="text-sm font-medium">Default Model</Label>
            <div className="relative">
              <select
                id="default-model"
                className="appearance-none flex h-10 w-full rounded-md border border-input bg-background pl-3 pr-10 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                value={settings.defaultModel}
                onChange={(event) =>
                  updateSettings({
                    defaultModel: event.target.value as typeof settings.defaultModel
                  })
                }
              >
                <optgroup label="OpenAI">
                  <option value="gpt-5.2">GPT-5.2</option>
                  <option value="gpt-5-mini">GPT-5 Mini</option>
                </optgroup>
                <optgroup label="Anthropic">
                  <option value="claude-opus-4.5">Claude Opus 4.5</option>
                  <option value="claude-sonnet-4.5">Claude Sonnet 4.5</option>
                  <option value="claude-haiku-4.5">Claude Haiku 4.5</option>
                </optgroup>
              </select>
              <ChevronDown className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Used as the default for new sessions.</p>
          </div>

          <div className="space-y-3 p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Auto-approval</Label>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoApprovalEnabled}
                onClick={() => updateSettings({ autoApprovalEnabled: !settings.autoApprovalEnabled })}
                className={`relative h-5 w-9 rounded-full border border-border transition-colors ${
                  settings.autoApprovalEnabled ? 'bg-emerald-500/60' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-[1px] h-4 w-4 rounded-full bg-background transition-transform ${
                    settings.autoApprovalEnabled ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
            <div className="relative">
              <select
                className="appearance-none flex h-10 w-full rounded-md border border-input bg-background pl-3 pr-10 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                value={settings.autoApprovalThreshold}
                onChange={(event) =>
                  updateSettings({
                    autoApprovalThreshold: event.target.value as typeof settings.autoApprovalThreshold
                  })
                }
                disabled={!settings.autoApprovalEnabled}
              >
                <option value="low">Low risk only</option>
                <option value="medium">Medium risk or lower</option>
                <option value="high">High risk (all)</option>
              </select>
              <ChevronDown className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Applies to new sessions unless overridden.</p>
          </div>

          <div className="space-y-3 p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Plan Panel</Label>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showPlanPanel}
                onClick={() => updateSettings({ showPlanPanel: !settings.showPlanPanel })}
                className={`relative h-5 w-9 rounded-full border border-border transition-colors ${
                  settings.showPlanPanel ? 'bg-emerald-500/60' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-[1px] h-4 w-4 rounded-full bg-background transition-transform ${
                    settings.showPlanPanel ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Show or hide the plan panel in chat.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-64 text-center">
        <p className="text-sm text-muted-foreground">Configuration panel coming soon</p>
      </div>
    );
  };

  const currentCategory = categories.find((cat) => cat.id === activeCategory);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-4">
        {activeCategory === 'overview' ? (
          <>
            <h3 className="text-lg font-semibold">Settings</h3>
            <p className="text-sm text-muted-foreground mt-1">Local preferences for SSH, security, and UI</p>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveCategory('overview')}
              className="text-xs text-muted-foreground hover:text-foreground mb-2"
            >
              ← Back to Settings
            </button>
            <h3 className="text-lg font-semibold">{currentCategory?.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{currentCategory?.description}</p>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default SettingsPane;
