import React from 'react';
import { Terminal, Bot, Shield, Server } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
};

const StatCard = ({ label, value, icon }: StatCardProps) => (
  <div className="p-4 rounded-lg border border-border bg-card">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-2xl font-light text-white mt-2">{value}</p>
      </div>
      <span className="text-neutral-700">{icon}</span>
    </div>
  </div>
);

type DashboardStatsProps = {
  activeSessions: number;
  totalHosts: number;
};

const DashboardStats = ({ activeSessions, totalHosts }: DashboardStatsProps) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-10">
      <StatCard
        label="Active Sessions"
        value={activeSessions}
        icon={<Terminal className="h-5 w-5" />}
      />
      <StatCard
        label="Agents Running"
        value={0}
        icon={<Bot className="h-5 w-5" />}
      />
      <StatCard
        label="Security Score"
        value="—"
        icon={<Shield className="h-5 w-5" />}
      />
      <StatCard
        label="Total Hosts"
        value={totalHosts}
        icon={<Server className="h-5 w-5" />}
      />
    </div>
  );
};

export default DashboardStats;
