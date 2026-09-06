'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Shield, User, FileSpreadsheet, ArrowUpRight, Cpu } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 glass-panel">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent">
                QuestionForge
              </span>
              <span className="ml-1 text-xs font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                AI
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-white/10">
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !isAdmin && pathname === '/dashboard'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/projects"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !isAdmin && pathname.startsWith('/projects')
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Projects
            </Link>
            <Link
              href="/exports"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !isAdmin && pathname.startsWith('/exports')
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Exports
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Admin / User Mode Toggle Switcher */}
          {isAdmin ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
            >
              <User className="w-3.5 h-3.5" />
              <span>Switch to User View</span>
            </Link>
          ) : (
            <Link
              href="/admin/ai"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Master Admin Portal</span>
            </Link>
          )}

          <Link
            href="/projects/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-glow transition-all"
          >
            <span>+ Upload PDF</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
