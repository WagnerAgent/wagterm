import React from 'react';

type SidebarFooterProps = {
  appInfo: { name: string; version: string } | null;
};

const SidebarFooter = ({ appInfo }: SidebarFooterProps) => {
  const versionLabel = appInfo ? `${appInfo.name} ${appInfo.version}` : 'Wagterm';
  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-center gap-2 text-[11px] text-neutral-500">
        <span className="text-neutral-400">{versionLabel}</span>
      </div>
    </div>
  );
};

export default SidebarFooter;
