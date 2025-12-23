import React from 'react';
import { Server, X } from 'lucide-react';
import type { TerminalSession } from './types';

type SessionTabsProps = {
  terminalSessions: TerminalSession[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  closeSession: (id: string) => void;
};

const SessionTabs = ({ terminalSessions, activeTab, setActiveTab, closeSession }: SessionTabsProps) => {
  return (
    <div className="flex items-end border-b border-border bg-card/50 px-4">
      <button
        onClick={() => setActiveTab('connections')}
        className={`relative px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 rounded-t-lg ${
          activeTab === 'connections'
            ? 'bg-background text-foreground border-t border-l border-r border-border'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <Server className="h-4 w-4" />
        <span>Connections</span>
      </button>

      {terminalSessions.map((session) => (
        <button
          key={session.id}
          onClick={() => setActiveTab(session.id)}
          className={`relative px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 rounded-t-lg min-w-0 max-w-xs ${
            activeTab === session.id
              ? 'bg-background text-foreground border-t border-l border-r border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <div className={`h-2 w-2 rounded-full ${session.connected ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
          <span className="truncate">{session.profile.name}</span>
          <button
            onClick={(event) => {
              event.stopPropagation();
              closeSession(session.id);
            }}
            className="ml-1 hover:bg-accent/50 rounded-sm p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </button>
      ))}
    </div>
  );
};

export default SessionTabs;
