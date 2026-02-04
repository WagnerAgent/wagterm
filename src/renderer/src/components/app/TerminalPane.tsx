import React from 'react';
import type { TerminalSession } from './types';

type TerminalPaneProps = {
  session: TerminalSession;
  attachTerminal: (sessionId: string, element: HTMLDivElement | null) => void;
};

const TerminalPane = ({
  session,
  attachTerminal
}: TerminalPaneProps) => {
  return (
    <main className="flex-1 flex flex-col overflow-hidden border-r border-[#262626] bg-[#050505]">
      <div className="px-4 py-2 border-b border-[#262626] bg-[#0a0a0a]">
        <p className="text-xs font-mono text-neutral-500">{session.status}</p>
      </div>

      <div className="flex-1 bg-[#050505] overflow-hidden shadow-glow">
        <div className="h-full w-full p-4">
          <div className="h-full w-full wagterm-terminal" ref={(element) => attachTerminal(session.id, element)} />
        </div>
      </div>
    </main>
  );
};

export default TerminalPane;
