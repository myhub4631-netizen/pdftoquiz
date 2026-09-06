'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Activity,
  Cpu,
  Database,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
} from 'lucide-react';

const adminNavItems = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Projects', href: '/admin/projects', icon: FolderKanban },
  { name: 'Processing Jobs', href: '/admin/jobs', icon: Activity },
  { name: 'AI / OpenRouter', href: '/admin/ai', icon: Cpu, badge: 'Active' },
  { name: 'Storage', href: '/admin/storage', icon: Database },
  { name: 'Exports', href: '/admin/exports', icon: FileSpreadsheet },
  { name: 'System Settings', href: '/admin/settings', icon: Settings },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: ShieldAlert },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-white/10 glass-panel min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div>
        <div className="px-3 py-2 mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Master Admin Controls
          </p>
        </div>

        <nav className="space-y-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-400 space-y-1">
        <div className="flex items-center justify-between font-semibold text-slate-300">
          <span>Security Mode</span>
          <span className="text-emerald-400">● Enforced</span>
        </div>
        <p className="text-[11px] text-slate-500">
          AES-256 encrypted API secrets & isolated multi-tenant RLS.
        </p>
      </div>
    </aside>
  );
}
