import React, { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { CommandHistoryEntry, TerminalSession } from './types';

type TerminalPaneProps = {
  session: TerminalSession;
  attachTerminal: (sessionId: string, element: HTMLDivElement | null) => void;
  findInTerminal: (sessionId: string, query: string, direction: 'next' | 'previous') => boolean;
  commandHistory: CommandHistoryEntry[];
};

const TerminalPane = ({
  session,
  attachTerminal,
  findInTerminal,
  commandHistory
}: TerminalPaneProps) => {
  const [terminalSearch, setTerminalSearch] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) {
      return commandHistory;
    }
    return commandHistory.filter((entry) => entry.command.toLowerCase().includes(query));
  }, [commandHistory, historyQuery]);

  const runSearch = (direction: 'next' | 'previous') => {
    const found = findInTerminal(session.id, terminalSearch, direction);
    setSearchStatus(found ? '' : 'No match');
  };

  return (
    <main className="flex-1 flex flex-col overflow-hidden border-r border-border">
      <div className="p-4 border-b border-border space-y-4">
        <p className="text-xs font-mono text-muted-foreground">{session.status}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Terminal Search</p>
            <div className="flex items-center gap-2">
              <Input
                value={terminalSearch}
                onChange={(event) => {
                  setTerminalSearch(event.target.value);
                  setSearchStatus('');
                }}
                placeholder="Find in terminal"
                className="h-8 text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => runSearch('previous')}>
                Prev
              </Button>
              <Button size="sm" variant="outline" onClick={() => runSearch('next')}>
                Next
              </Button>
            </div>
            {searchStatus && <p className="text-[11px] text-muted-foreground">{searchStatus}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Command History</p>
              <Input
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="Search history"
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="max-h-28 overflow-y-auto rounded-md border border-border bg-muted/40 p-2 space-y-1">
              {filteredHistory.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No commands yet.</p>
              ) : (
                filteredHistory.slice(0, 40).map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-2 text-[11px]">
                    <code className="text-foreground font-mono break-all">{entry.command}</code>
                    <span className="text-muted-foreground shrink-0">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-black overflow-hidden">
        <div className="h-full w-full wagterm-terminal" ref={(element) => attachTerminal(session.id, element)} />
      </div>
    </main>
  );
};

export default TerminalPane;
