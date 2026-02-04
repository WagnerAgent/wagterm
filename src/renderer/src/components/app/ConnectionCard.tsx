import React from 'react';
import { Server, CheckCircle, Edit2, Trash2 } from 'lucide-react';
import type { ConnectionProfile, TerminalSession } from './types';

type ConnectionCardProps = {
  profile: ConnectionProfile;
  isConnected: boolean;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const ConnectionCard = ({ profile, isConnected, onConnect, onEdit, onDelete }: ConnectionCardProps) => {
  const isDemo = profile.id.startsWith('demo-');
  const status = isConnected ? 'Live' : 'Idle';

  return (
    <div className="group relative bg-card rounded-xl p-5 border border-border hover:border-neutral-600 transition-all duration-300">
      {/* Top: icon + name + status badge */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-neutral-900 flex items-center justify-center border border-neutral-800">
            <Server className="h-5 w-5 text-neutral-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white group-hover:text-primary transition-colors">
              {profile.name}
            </h3>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">{profile.host}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-900/50 ${
            isConnected
              ? 'border border-neutral-700 text-neutral-300'
              : 'border border-neutral-800 text-neutral-500'
          }`}
        >
          {isConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse" />
          )}
          {status}
        </span>
      </div>

      {/* Details rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">User</span>
          <span className="text-neutral-300">{profile.username}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Port</span>
          <span className="text-neutral-300">{profile.port}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Auth</span>
          <span className="text-neutral-300">{profile.authMethod === 'pem' ? 'SSH Key' : 'Password'}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Agent Status</span>
          {isConnected ? (
            <span className="inline-flex items-center text-white font-medium">
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Ready
            </span>
          ) : (
            <span className="text-neutral-500">Standby</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isDemo && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] border border-neutral-800 text-neutral-400 font-mono tracking-wide uppercase">
              Sample
            </span>
          )}
          {profile.jumpHost && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] border border-neutral-800 text-neutral-400 font-mono tracking-wide uppercase">
              Jump Host
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isDemo && (
            <>
              <button
                type="button"
                className="p-1 rounded text-neutral-500 hover:text-white transition-colors"
                onClick={onEdit}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="p-1 rounded text-neutral-500 hover:text-white transition-colors"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            className={`text-xs font-medium px-4 py-1.5 rounded transition-colors ${
              isConnected
                ? 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                : isDemo
                  ? 'border border-neutral-800 text-neutral-600 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-neutral-200 shadow-glow'
            }`}
            onClick={isDemo ? undefined : onConnect}
            disabled={isDemo}
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionCard;
