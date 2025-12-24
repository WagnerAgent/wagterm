import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AppSettings = {
  defaultModel: 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5';
  autoApprovalEnabled: boolean;
  autoApprovalThreshold: 'low' | 'medium' | 'high';
  showPlanPanel: boolean;
};

type SettingsContextValue = {
  settings: AppSettings;
  loaded: boolean;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
};

const defaultSettings: AppSettings = {
  defaultModel: 'gpt-5.2',
  autoApprovalEnabled: false,
  autoApprovalThreshold: 'low',
  showPlanPanel: true
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const response = await window.wagterm.settings.getAppSettings();
      setSettings(response.settings);
      setLoaded(true);
    };
    void loadSettings();
  }, []);

  const updateSettings = useCallback(async (next: Partial<AppSettings>) => {
    const response = await window.wagterm.settings.updateAppSettings({ settings: next });
    setSettings(response.settings);
  }, []);

  const value = useMemo(
    () => ({
      settings,
      loaded,
      updateSettings
    }),
    [settings, loaded, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within SettingsProvider');
  }
  return context;
};
