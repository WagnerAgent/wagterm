import React from 'react';
import { Key, FileKey, ShieldCheck, Copy, Edit2, Trash2 } from 'lucide-react';
import type { KeyRecord } from './types';

type VaultCardProps = {
  record: KeyRecord;
  onEdit: () => void;
  onDelete: () => void;
};

const typeLabel = (type: KeyRecord['type']): string => {
  switch (type) {
    case 'ed25519':
      return 'SSH KEY';
    case 'rsa':
      return 'SSH KEY';
    case 'pem':
      return 'PEM FILE';
    default:
      return 'KEY';
  }
};

const VaultCard = ({ record, onEdit, onDelete }: VaultCardProps) => {
  const icon = record.type === 'pem' ? (
    <FileKey className="h-5 w-5 text-neutral-400" />
  ) : (
    <Key className="h-5 w-5 text-neutral-400" />
  );

  return (
    <div className="group relative bg-card rounded-xl p-5 border border-border hover:border-neutral-600 transition-all duration-300">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-neutral-900 flex items-center justify-center border border-neutral-800">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white group-hover:text-primary transition-colors">
              {record.name}
            </h3>
            <p className="text-xs text-neutral-500 font-mono mt-0.5 truncate max-w-[180px]">
              {record.fingerprint || record.type.toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Type</span>
          <span className="text-neutral-300 font-mono text-[10px] bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
            {typeLabel(record.type)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Algorithm</span>
          <span className="text-neutral-400">{record.type.toUpperCase()}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Security Health</span>
          <span className="inline-flex items-center text-green-500 font-medium text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
            Verified
          </span>
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex-1 inline-flex justify-center items-center px-2 py-1.5 border border-neutral-800 rounded bg-neutral-900/50 hover:bg-neutral-800 text-[10px] font-medium text-neutral-300 transition-colors"
          onClick={() => {
            const text = record.fingerprint || record.name;
            void navigator.clipboard.writeText(text);
          }}
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
        </button>
        <button
          type="button"
          className="flex-1 inline-flex justify-center items-center px-2 py-1.5 border border-neutral-800 rounded bg-neutral-900/50 hover:bg-neutral-800 text-[10px] font-medium text-neutral-300 transition-colors"
          onClick={onEdit}
        >
          <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
        </button>
        <button
          type="button"
          className="flex-1 inline-flex justify-center items-center px-2 py-1.5 border border-neutral-800 rounded bg-neutral-900/50 hover:bg-neutral-800 text-[10px] font-medium text-neutral-300 transition-colors"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
        </button>
      </div>
    </div>
  );
};

export default VaultCard;
