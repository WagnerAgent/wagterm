import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ChevronRight } from 'lucide-react';

type AiProvider = 'openai' | 'anthropic';
type SettingsCategory = 'overview' | 'ai-providers' | 'host-key-policy' | 'session-defaults' | 'security' | 'tooling';

const SettingsPane = () => {
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
