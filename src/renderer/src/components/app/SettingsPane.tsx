import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSettingsContext } from '../../context/SettingsContext';

type AiProvider = 'openai' | 'anthropic';
type PreferencesTab = 'models' | 'terminal' | 'general';

const SettingsPane = () => {
  const { settings, updateSettings } = useSettingsContext();
  const [activeTab, setActiveTab] = useState<PreferencesTab>('models');
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

  return (
    <div className="h-full flex flex-col">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center space-x-6">
          <h1 className="text-lg font-medium text-white">Preferences</h1>
          <div className="h-4 w-px bg-border" />
          <nav className="flex space-x-4">
            <button
              className={`text-sm font-medium pb-[22px] pt-[22px] ${
                activeTab === 'models'
                  ? 'text-white border-b-2 border-white'
                  : 'text-neutral-500 hover:text-neutral-300 transition-colors'
              }`}
              onClick={() => setActiveTab('models')}
            >
              Models & Providers
            </button>
            <button
              className={`text-sm font-medium pb-[22px] pt-[22px] ${
                activeTab === 'terminal'
                  ? 'text-white border-b-2 border-white'
                  : 'text-neutral-500 hover:text-neutral-300 transition-colors'
              }`}
              onClick={() => setActiveTab('terminal')}
            >
              Terminal
            </button>
            <button
              className={`text-sm font-medium pb-[22px] pt-[22px] ${
                activeTab === 'general'
                  ? 'text-white border-b-2 border-white'
                  : 'text-neutral-500 hover:text-neutral-300 transition-colors'
              }`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
          </nav>
        </div>
        <div className="flex items-center space-x-4" aria-hidden="true" />
      </header>

      <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'models' && (
          <>
            <div className="mb-8">
              <div className="mt-4">
                <h2 className="text-2xl font-medium text-white tracking-tight">AI Providers</h2>
                <p className="text-sm text-neutral-500 mt-1">Store local API keys for OpenAI and Anthropic. Keys are stored encrypted.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              <div className="bg-[#0a0a0a] rounded-xl border border-[#262626] p-6 shadow-subtle group hover:border-neutral-700 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white">OpenAI API Key</h3>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-900 border border-neutral-800 text-neutral-500">
                    {aiKeyStatus.openai.configured ? 'Configured' : 'Not set'}
                  </span>
                </div>
                <div className="relative mb-6">
                  <input
                    className="w-full bg-[#050505] border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-neutral-600 focus:ring-0 transition-all"
                    placeholder={aiKeyStatus.openai.configured ? '••••••••••••••••' : 'sk-...'}
                    type="password"
                    value={aiKeyInputs.openai}
                    onChange={(event) =>
                      setAiKeyInputs((prev) => ({ ...prev, openai: event.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="text-xs font-medium px-4 py-1.5 rounded transition-colors bg-white text-black hover:bg-neutral-200 shadow-glow"
                    onClick={() => handleSaveKey('openai')}
                  >
                    Save
                  </button>
                  <button
                    className="text-xs font-medium px-4 py-1.5 rounded transition-colors border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                    onClick={() => handleClearKey('openai')}
                  >
                    Clear
                  </button>
                </div>
                {aiKeyStatus.openai.error && (
                  <p className="text-xs text-red-400 mt-3">{aiKeyStatus.openai.error}</p>
                )}
              </div>

              <div className="bg-[#0a0a0a] rounded-xl border border-[#262626] p-6 shadow-subtle group hover:border-neutral-700 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white">Anthropic API Key</h3>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-900 border border-neutral-800 text-neutral-500">
                    {aiKeyStatus.anthropic.configured ? 'Configured' : 'Not set'}
                  </span>
                </div>
                <div className="relative mb-6">
                  <input
                    className="w-full bg-[#050505] border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-neutral-600 focus:ring-0 transition-all"
                    placeholder={aiKeyStatus.anthropic.configured ? '••••••••••••••••' : 'sk-ant-...'}
                    type="password"
                    value={aiKeyInputs.anthropic}
                    onChange={(event) =>
                      setAiKeyInputs((prev) => ({ ...prev, anthropic: event.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="text-xs font-medium px-4 py-1.5 rounded transition-colors bg-white text-black hover:bg-neutral-200 shadow-glow"
                    onClick={() => handleSaveKey('anthropic')}
                  >
                    Save
                  </button>
                  <button
                    className="text-xs font-medium px-4 py-1.5 rounded transition-colors border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                    onClick={() => handleClearKey('anthropic')}
                  >
                    Clear
                  </button>
                </div>
                {aiKeyStatus.anthropic.error && (
                  <p className="text-xs text-red-400 mt-3">{aiKeyStatus.anthropic.error}</p>
                )}
              </div>
            </div>

            <div className="border-t border-[#262626] my-8" />

            <div className="mb-10">
              <div className="mb-6">
                <h3 className="text-lg font-medium text-white">AI Defaults</h3>
                <p className="text-sm text-neutral-500 mt-1">Default model and approval behavior for new sessions.</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-xl border border-[#262626] divide-y divide-[#262626]">
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">Default Model</h4>
                    <p className="text-xs text-neutral-500 mt-1">Used as the default for new sessions</p>
                  </div>
                  <div className="relative">
                    <select
                      className="bg-[#050505] border border-neutral-800 text-white text-xs rounded-lg px-3 py-1.5 focus:ring-0 focus:border-neutral-600"
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
                    <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
                  </div>
                </div>
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">Auto-Approval</h4>
                    <p className="text-xs text-neutral-500 mt-1">Automatically approve low-risk commands</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.autoApprovalEnabled}
                    onClick={() => updateSettings({ autoApprovalEnabled: !settings.autoApprovalEnabled })}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      settings.autoApprovalEnabled ? 'bg-neutral-400' : 'bg-neutral-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.autoApprovalEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">Auto-Approval Threshold</h4>
                    <p className="text-xs text-neutral-500 mt-1">Max risk allowed for auto-approval</p>
                  </div>
                  <div className="relative">
                    <select
                      className="bg-[#050505] border border-neutral-800 text-white text-xs rounded-lg px-3 py-1.5 focus:ring-0 focus:border-neutral-600 disabled:opacity-50"
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
                    <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
                  </div>
                </div>
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">Plan Panel</h4>
                    <p className="text-xs text-neutral-500 mt-1">Show or hide the plan panel in chat</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.showPlanPanel}
                    onClick={() => updateSettings({ showPlanPanel: !settings.showPlanPanel })}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      settings.showPlanPanel ? 'bg-neutral-400' : 'bg-neutral-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.showPlanPanel ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'terminal' && (
          <div className="mb-10">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white">Terminal Appearance</h3>
              <p className="text-sm text-neutral-500 mt-1">Customize the look and feel of your SSH sessions.</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl border border-[#262626] divide-y divide-[#262626] opacity-60">
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">Font Size</h4>
                  <p className="text-xs text-neutral-500 mt-1">Default font size for new terminal windows</p>
                </div>
                <div className="flex items-center gap-3 bg-[#050505] rounded-lg p-1 border border-neutral-800">
                  <button className="p-1 text-neutral-500" disabled>−</button>
                  <span className="text-xs font-mono text-white w-8 text-center">13px</span>
                  <button className="p-1 text-neutral-500" disabled>+</button>
                </div>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">Font Family</h4>
                  <p className="text-xs text-neutral-500 mt-1">Must be a monospace font installed on your system</p>
                </div>
                <select className="bg-[#050505] border border-neutral-800 text-white text-xs rounded-lg px-3 py-1.5" disabled>
                  <option>Fira Code</option>
                </select>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">Theme Override</h4>
                  <p className="text-xs text-neutral-500 mt-1">Force a specific color scheme regardless of system settings</p>
                </div>
                <div className="flex gap-2">
                  <button className="h-6 w-6 rounded-full bg-black border border-white ring-2 ring-offset-2 ring-offset-[#0a0a0a] ring-neutral-700" disabled />
                  <button className="h-6 w-6 rounded-full bg-neutral-800 border border-transparent" disabled />
                  <button className="h-6 w-6 rounded-full bg-[#1e1e1e] border border-transparent" disabled />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="mb-10">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white">General</h3>
              <p className="text-sm text-neutral-500 mt-1">Application defaults and behavior.</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl border border-[#262626] divide-y divide-[#262626] opacity-60">
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">Default SSH User</h4>
                  <p className="text-xs text-neutral-500 mt-1">Used when no username is specified in connection string</p>
                </div>
                <input
                  className="w-48 bg-[#050505] border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600"
                  placeholder="root"
                  type="text"
                  disabled
                />
              </div>
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">Auto-Update</h4>
                  <p className="text-xs text-neutral-500 mt-1">Automatically download and install updates</p>
                </div>
                <button
                  className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent bg-neutral-700"
                  disabled
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none inline-block h-4 w-4 translate-x-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPane;
