import React from 'react';

const baseClasses =
  'w-full flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors';

const activeClasses = 'text-white bg-white/10 shadow-glow';

const inactiveClasses = 'text-neutral-400 hover:text-white hover:bg-white/5';

const disabledClasses = 'text-neutral-600 cursor-not-allowed';

type SidebarNavItemProps = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

const SidebarNavItem = ({ label, icon, active, disabled, onClick }: SidebarNavItemProps) => {
  const stateClasses = disabled ? disabledClasses : active ? activeClasses : inactiveClasses;
  const iconClasses = disabled
    ? 'text-neutral-600'
    : active
      ? 'text-white'
      : 'text-neutral-400';

  return (
    <button
      type="button"
      className={`${baseClasses} ${stateClasses}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span className={`mr-3 ${iconClasses}`}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
};

export default SidebarNavItem;
