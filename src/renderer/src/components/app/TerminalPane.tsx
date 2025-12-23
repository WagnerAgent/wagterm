import React from 'react';
import type { TerminalSession } from './types';

type TerminalPaneProps = {
  session: TerminalSession;
  attachTerminal: (sessionId: string, element: HTMLDivElement | null) => void;
};

const TerminalPane = ({ session, attachTerminal }: TerminalPaneProps) => {
  return (
    <main className="flex-1 flex flex-col overflow-hidden border-r border-border">
      <div className="p-4 border-b border-border">
        <p className="text-xs font-mono text-muted-foreground">{session.status}</p>
      </div>

      <div className="flex-1 bg-black overflow-hidden">
        <div className="h-full w-full wagterm-terminal" ref={(element) => attachTerminal(session.id, element)} />
      </div>
    </main>
  );
};

export default TerminalPane;
