import React from 'react';
import WagtermLogo from '../../assets/wagterm_logo.svg';
import type { SectionKey } from './types';

export type SidebarSection = {
  id: SectionKey;
  label: string;
  icon: React.ReactNode;
};

type SidebarProps = {
  section: SectionKey;
  sections: SidebarSection[];
  setSection: (section: SectionKey) => void;
  appInfo: { name: string; version: string } | null;
};

const Sidebar = ({ section, sections, setSection, appInfo }: SidebarProps) => {
  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col">
      <div className="p-6 border-b border-border flex items-center">
        <img src={WagtermLogo} alt="Wagterm" className="h-auto w-56" />
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {sections.map((item) => (
          <button
            key={item.id}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              section === item.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            onClick={() => setSection(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="rounded-lg bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
          {appInfo ? `${appInfo.name} v${appInfo.version}` : 'Loading...'}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
