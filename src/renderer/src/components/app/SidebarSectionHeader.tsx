import React from 'react';

type SidebarSectionHeaderProps = {
  label: string;
};

const SidebarSectionHeader = ({ label }: SidebarSectionHeaderProps) => {
  return (
    <p className="px-2 text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
      {label}
    </p>
  );
};

export default SidebarSectionHeader;
