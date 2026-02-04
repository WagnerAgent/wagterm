import React from 'react';
import WagtermLogo from '../../assets/wagterm_logo.svg';

const SidebarHeader = () => {
  return (
    <div className="h-16 flex items-center px-6 border-b border-border">
      <img src={WagtermLogo} alt="Wagterm" className="h-auto w-36" />
    </div>
  );
};

export default SidebarHeader;
