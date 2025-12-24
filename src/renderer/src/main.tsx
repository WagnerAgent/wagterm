import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { KeysProvider } from './context/KeysContext';
import { SettingsProvider } from './context/SettingsContext';
import './index.css';

const container = document.getElementById('app');

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <SettingsProvider>
        <KeysProvider>
          <App />
        </KeysProvider>
      </SettingsProvider>
    </React.StrictMode>
  );
}
