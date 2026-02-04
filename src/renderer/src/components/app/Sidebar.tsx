import React, { useMemo } from 'react';
import type { SectionKey } from './types';
import SidebarFooter from './SidebarFooter';
import SidebarHeader from './SidebarHeader';
import SidebarNavItem from './SidebarNavItem';
import SidebarSectionHeader from './SidebarSectionHeader';

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

const GROUP_ORDER = ['Platform', 'Intelligence', 'System'] as const;

const Sidebar = ({ section, sections, setSection, appInfo }: SidebarProps) => {
  const groupedSections = useMemo(() => {
    const groupMap: Record<SectionKey, string> = {
      connections: 'Platform',
      vaults: 'Platform',
      files: 'Platform',
      'ai-agents': 'Intelligence',
      'agent-settings': 'Intelligence',
      runbooks: 'Intelligence',
      preferences: 'System'
    };

    const groups: Record<string, SidebarSection[]> = {};
    sections.forEach((item) => {
      const groupLabel = groupMap[item.id] ?? 'Platform';
      if (!groups[groupLabel]) {
        groups[groupLabel] = [];
      }
      groups[groupLabel].push(item);
    });

    return GROUP_ORDER.filter((label) => groups[label])
      .map((label) => ({ label, items: groups[label] }))
      .concat(
        Object.keys(groups)
          .filter((label) => !GROUP_ORDER.includes(label as (typeof GROUP_ORDER)[number]))
          .map((label) => ({ label, items: groups[label] }))
      );
  }, [sections]);

  return (
    <aside className="w-64 flex-shrink-0 bg-black text-white border-r border-border flex flex-col h-screen">
      <SidebarHeader />

      <nav className="flex-1 px-4 py-6 space-y-1">
        {groupedSections.map((group) => (
          <div key={group.label} className="mb-6">
            <SidebarSectionHeader label={group.label} />
            {group.items.map((item) => (
              <SidebarNavItem
                key={item.id}
                label={item.label}
                icon={item.icon}
                active={section === item.id}
                onClick={() => setSection(item.id)}
              />
            ))}
          </div>
        ))}
      </nav>

      <SidebarFooter appInfo={appInfo} />
    </aside>
  );
};

export default Sidebar;
