'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FileSpreadsheet, ShieldAlert, Sparkles, FolderKanban, PlusCircle, LayoutDashboard, LogOut, LogIn, User } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const [authUser, setAuthUser] = useState<any>(null);

  useEffect(() => {
    async function getAuth() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user) setAuthUser(data.user);
      } catch {
        // Unauthenticated
      }
    }
    getAuth();
  }, []);

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Continue
    }
    window.location.href = '/login';
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo & Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-glow group-hover:scale-105 transition-transform duration-300">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                QuestionForge
              </span>
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                AI NEET/JEE
              </span>
            </div>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === '/dashboard'
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </span>
            </Link>

            <Link
              href="/projects/new"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === '/projects/new'
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4" />
                New PDF Project
              </span>
            </Link>
          </nav>
        </div>

        {/* Right Action Icons & Admin Gateway */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/ai"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900/60 hover:border-indigo-500/50 transition-all shadow-sm"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-indigo-400" />
            <span>Master Admin</span>
          </Link>

          {authUser ? (
            <div className="flex items-center gap-2">
              <span className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300">
                <User className="h-3.5 w-3.5 text-blue-400" />
                <span>{authUser.email}</span>
              </span>
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-400" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-glow transition-all"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
