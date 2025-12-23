import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { ConnectionProfile, TerminalSession } from '../components/app/types';

type UseSshSessionsOptions = {
  onSessionStart?: (sessionId: string) => void;
  onSessionClose?: (sessionId: string) => void;
};

export const useSshSessions = ({ onSessionStart, onSessionClose }: UseSshSessionsOptions = {}) => {
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);
  const [activeTab, setActiveTab] = useState<'connections' | string>('connections');

  const sessionReceivedData = useRef<Map<string, boolean>>(new Map());
  const connectTimeouts = useRef<Map<string, number>>(new Map());
  const sessionListeners = useRef<Map<string, { onData: () => void; onExit: () => void }>>(new Map());
  const terminalsById = useRef<Map<string, XTerm>>(new Map());
  const terminalContainersById = useRef<Map<string, HTMLDivElement>>(new Map());
  const fitAddonsById = useRef<Map<string, FitAddon>>(new Map());

  const ensureTerminal = useCallback((sessionId: string) => {
    const existing = terminalsById.current.get(sessionId);
    if (existing) {
      return existing;
    }

    const terminal = new XTerm({
      cursorBlink: true,
      convertEol: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#050505',
        foreground: '#d1d5db'
      }
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    fitAddonsById.current.set(sessionId, fitAddon);

    terminal.onData((data) => {
      void window.wagterm.sshSession.sendInput({ sessionId, data });
    });

    terminalsById.current.set(sessionId, terminal);
    return terminal;
  }, []);

  const attachTerminal = useCallback(
    (sessionId: string, element: HTMLDivElement | null) => {
      if (!element) {
        terminalContainersById.current.delete(sessionId);
        return;
      }

      terminalContainersById.current.set(sessionId, element);
      const terminal = ensureTerminal(sessionId);
      if (terminal.element !== element) {
        terminal.open(element);
        const fitAddon = fitAddonsById.current.get(sessionId);
        if (fitAddon) {
          setTimeout(() => fitAddon.fit(), 0);
        }
      }
    },
    [ensureTerminal]
  );

  const writeToTerminal = useCallback(
    (sessionId: string, text: string) => {
      const terminal = terminalsById.current.get(sessionId) ?? ensureTerminal(sessionId);
      terminal.write(text);
    },
    [ensureTerminal]
  );

  const updateSessionStatus = (sessionId: string, status: string, connected: boolean) => {
    setTerminalSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, status, connected }
          : session
      )
    );
  };

  const connectToProfile = async (profile: ConnectionProfile) => {
    let response: { sessionId: string };
    try {
      response = await window.wagterm.sshSession.start({
        profile,
        cols: 100,
        rows: 30
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start SSH session.';
      window.alert(message);
      return;
    }

    const newSession: TerminalSession = {
      id: response.sessionId,
      profile,
      status: `Connecting to ${profile.username}@${profile.host}...`,
      connected: false
    };

    setTerminalSessions((prev) => [...prev, newSession]);
    ensureTerminal(response.sessionId);
    onSessionStart?.(response.sessionId);
    setActiveTab(response.sessionId);

    sessionReceivedData.current.set(response.sessionId, false);

    const timeout = window.setTimeout(() => {
      if (!sessionReceivedData.current.get(response.sessionId)) {
        updateSessionStatus(
          response.sessionId,
          `No response from ${profile.host}. Check network or host availability.`,
          false
        );
      }
    }, 12000);
    connectTimeouts.current.set(response.sessionId, timeout);

    const removeDataListener = window.wagterm.sshSession.onData((payload) => {
      if (payload.sessionId !== response.sessionId) return;

      if (!sessionReceivedData.current.get(response.sessionId)) {
        sessionReceivedData.current.set(response.sessionId, true);
        const timeout = connectTimeouts.current.get(response.sessionId);
        if (timeout) {
          window.clearTimeout(timeout);
          connectTimeouts.current.delete(response.sessionId);
        }
        updateSessionStatus(
          response.sessionId,
          `Connected: ${profile.username}@${profile.host}`,
          true
        );
      }
      writeToTerminal(response.sessionId, payload.data);
    });

    const removeExitListener = window.wagterm.sshSession.onExit((payload) => {
      if (payload.sessionId !== response.sessionId) return;

      const timeout = connectTimeouts.current.get(response.sessionId);
      if (timeout) {
        window.clearTimeout(timeout);
        connectTimeouts.current.delete(response.sessionId);
      }

      writeToTerminal(response.sessionId, `\n[session closed exit=${payload.exitCode ?? 'null'}]\n`);

      if (!sessionReceivedData.current.get(response.sessionId)) {
        updateSessionStatus(
          response.sessionId,
          `Connection failed (exit ${payload.exitCode ?? 'null'}).`,
          false
        );
      } else {
        updateSessionStatus(response.sessionId, 'Disconnected', false);
      }
    });

    sessionListeners.current.set(response.sessionId, {
      onData: removeDataListener,
      onExit: removeExitListener
    });
  };

  const closeSession = useCallback(async (sessionId: string) => {
    await window.wagterm.sshSession.close({ sessionId });

    const listeners = sessionListeners.current.get(sessionId);
    if (listeners) {
      listeners.onData();
      listeners.onExit();
      sessionListeners.current.delete(sessionId);
    }

    const timeout = connectTimeouts.current.get(sessionId);
    if (timeout) {
      window.clearTimeout(timeout);
      connectTimeouts.current.delete(sessionId);
    }

    sessionReceivedData.current.delete(sessionId);
    const terminal = terminalsById.current.get(sessionId);
    if (terminal) {
      terminal.dispose();
      terminalsById.current.delete(sessionId);
    }
    terminalContainersById.current.delete(sessionId);
    fitAddonsById.current.delete(sessionId);

    setTerminalSessions((prev) => prev.filter((session) => session.id !== sessionId));
    onSessionClose?.(sessionId);

    if (activeTab === sessionId) {
      setActiveTab('connections');
    }
  }, [activeTab, onSessionClose]);

  useEffect(() => {
    return () => {
      sessionListeners.current.forEach((listeners) => {
        listeners.onData();
        listeners.onExit();
      });
      connectTimeouts.current.forEach((timeout) => window.clearTimeout(timeout));
      terminalsById.current.forEach((terminal) => terminal.dispose());
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'connections') {
      return;
    }
    const terminal = terminalsById.current.get(activeTab);
    if (terminal) {
      const fitAddon = fitAddonsById.current.get(activeTab);
      if (fitAddon) {
        fitAddon.fit();
      }
      terminal.refresh(0, terminal.rows - 1);
      terminal.focus();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => {
      if (activeTab === 'connections') {
        return;
      }
      const terminal = terminalsById.current.get(activeTab);
      const fitAddon = fitAddonsById.current.get(activeTab);
      if (terminal && fitAddon) {
        fitAddon.fit();
        void window.wagterm.sshSession.resize({
          sessionId: activeTab,
          cols: terminal.cols,
          rows: terminal.rows
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  return {
    terminalSessions,
    activeTab,
    setActiveTab,
    connectToProfile,
    closeSession,
    attachTerminal
  };
};
