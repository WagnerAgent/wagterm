import React from 'react';
import type { LucideIcon } from 'lucide-react';

type ComingSoonPaneProps = {
  title: string;
  headline: string;
  description: string;
  icon: LucideIcon;
  onBack?: () => void;
};

const ComingSoonPane = ({ title, headline, description, icon: Icon, onBack }: ComingSoonPaneProps) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden bg-[#050505]">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
        <Icon className="h-[360px] w-[360px] text-white" />
      </div>
      <div className="relative z-10 flex flex-col items-center max-w-lg text-center">
        <div className="h-24 w-24 rounded-2xl bg-[#0a0a0a] border border-[#262626] flex items-center justify-center mb-8 shadow-glow">
          <Icon className="h-12 w-12 text-neutral-400" />
        </div>
        <h2 className="font-mono text-sm font-medium text-neutral-400 tracking-wider mb-4">FEATURE_UNDER_DEVELOPMENT</h2>
        <h1 className="text-3xl font-light text-white mb-4">{title}</h1>
        <p className="text-neutral-500 text-sm leading-relaxed mb-10 max-w-sm">{description}</p>
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="text-xs text-neutral-600 uppercase tracking-wide">{headline}</div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mt-2 flex items-center gap-1.5 group"
            >
              <span className="transition-transform group-hover:-translate-x-0.5">←</span>
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />
    </div>
  );
};

export default ComingSoonPane;
