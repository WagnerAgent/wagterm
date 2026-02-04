import React from 'react';
import { Search, Bell, Plus } from 'lucide-react';

type DashboardHeaderProps = {
  onAddNew: () => void;
};

const tabs = ['All Profiles', 'Recent', 'Favorites'] as const;

const DashboardHeader = ({ onAddNew }: DashboardHeaderProps) => {
  const [activeTab, setActiveTab] = React.useState<string>('All Profiles');

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center space-x-6">
        <h1 className="text-lg font-medium text-white">Dashboard</h1>
        <div className="h-4 w-px bg-border" />
        <nav className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`text-sm font-medium pb-[22px] pt-[22px] transition-colors ${
                activeTab === tab
                  ? 'text-white border-b-2 border-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-[18px] w-[18px] text-neutral-500" />
          </div>
          <input
            className="block w-64 pl-10 pr-3 py-1.5 border border-border rounded-lg leading-5 bg-[#0a0a0a] text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-0 text-sm transition-all"
            placeholder="Search..."
            type="text"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <kbd className="text-[10px] font-mono text-neutral-600 border border-neutral-800 rounded px-1">
              ⌘K
            </kbd>
          </div>
        </div>
        <button
          type="button"
          className="text-neutral-500 hover:text-white transition-colors relative"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 bg-neutral-500 rounded-full ring-2 ring-background transform translate-x-1/4 -translate-y-1/4" />
        </button>
        <button
          type="button"
          className="inline-flex items-center px-3 py-1.5 border border-white/20 text-xs font-medium rounded-md text-white bg-white/5 hover:bg-white/10 transition-colors"
          onClick={onAddNew}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New
        </button>
      </div>
    </header>
  );
};

export default DashboardHeader;
