'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  FolderKanban,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

const userNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'New Project', href: '/projects/new', icon: PlusCircle, isPrimary: true },
  { name: 'My Projects', href: '/dashboard#projects', icon: FolderKanban },
];

export function UserSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)] p-4">
      <div className="space-y-6">
        {/* Quick Exam Preset Pill */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-950/40 via-indigo-950/30 to-slate-900/50 border border-blue-500/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-semibold text-blue-300">
              Exam Engine Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            NEET 180/200 &amp; JEE Mains/Adv Multi-Sheet Parser
          </p>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1.5">
          {userNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  item.isPrimary
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-glow font-semibold'
                    : isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <Icon className={`h-4 w-4 ${item.isPrimary ? 'text-white' : isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-2">
          <span>Excel Engine:</span>
          <span className="font-mono text-emerald-400">exceljs v4.4</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-2">
          <span>Diagram Extractor:</span>
          <span className="font-mono text-blue-400">Sharp + Potrace</span>
        </div>
      </div>
    </aside>
  );
}
