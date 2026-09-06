'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileQuestion,
  Cpu,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({
    total_users: 0,
    total_projects: 0,
    total_questions: 0,
    total_jobs: 0,
    total_exports: 0,
  });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverview();
  }, []);

  async function fetchOverview() {
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setRecentProjects(data.recent_projects || []);
        setRecentJobs(data.recent_jobs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-blue-400" />
            System Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global monitoring of QuestionForge AI pipelines, users, and extraction throughput.
          </p>
        </div>

        <Link
          href="/admin/ai"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-glow transition-all"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Manage OpenRouter AI</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Users</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats.total_users}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Projects</span>
            <FolderKanban className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats.total_projects}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Questions Extracted</span>
            <FileQuestion className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono">{stats.total_questions}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Processing Jobs</span>
            <Cpu className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats.total_jobs}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Excel Exports</span>
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats.total_exports}</p>
        </div>
      </div>

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-base font-semibold text-white">Recent PDF Projects</h2>
            <Link href="/admin/projects" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentProjects.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No projects yet.</p>
            ) : (
              recentProjects.map((p) => (
                <div key={p.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-white">{p.name}</p>
                    <p className="text-slate-400 text-[11px]">{p.exam_type} • {p.extracted_questions} Questions</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {p.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Processing Jobs */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-base font-semibold text-white">Recent Processing Jobs</h2>
            <Link href="/admin/jobs" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentJobs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No jobs logged yet.</p>
            ) : (
              recentJobs.map((j) => (
                <div key={j.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-white font-mono">{j.step_name}</p>
                    <p className="text-slate-400 text-[11px]">{j.model_used || 'Gemini 2.5 Flash'} • {formatDate(j.created_at)}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {j.status} ({j.progress}%)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
