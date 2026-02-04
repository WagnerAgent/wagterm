import React from 'react';
import { Lock, Share2, Timer, Shield } from 'lucide-react';

type VaultsStatsProps = {
  totalSecrets: number;
};

const VaultsStats = ({ totalSecrets }: VaultsStatsProps) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-10">
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Total Secrets</p>
            <p className="text-2xl font-light text-white mt-2">{totalSecrets}</p>
          </div>
          <Lock className="h-5 w-5 text-neutral-700" />
        </div>
      </div>
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Shared</p>
            <p className="text-2xl font-light text-white mt-2">0</p>
          </div>
          <Share2 className="h-5 w-5 text-neutral-700" />
        </div>
      </div>
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Expiring Soon</p>
            <p className="text-2xl font-light text-white mt-2">0</p>
          </div>
          <Timer className="h-5 w-5 text-neutral-700" />
        </div>
      </div>
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Vault Health</p>
            <p className="text-2xl font-light text-white mt-2">100%</p>
          </div>
          <Shield className="h-5 w-5 text-neutral-700" />
        </div>
      </div>
    </div>
  );
};

export default VaultsStats;
