import React from 'react';

type SidebarFooterProps = {
  appInfo: { name: string; version: string } | null;
};

const SidebarFooter = ({ appInfo }: SidebarFooterProps) => {
  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-neutral-900 flex items-center justify-center text-xs text-white border border-neutral-800">
          JD
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-white">John Doe</span>
          <span className="text-[10px] text-neutral-500">Engineering Lead</span>
        </div>
      </div>
    </div>
  );
};

export default SidebarFooter;
