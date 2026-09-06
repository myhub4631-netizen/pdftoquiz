'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  FolderKanban,
  FileSpreadsheet,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Database,
  Activity,
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils';

export default function AdminOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = data?.stats || {
    totalUsers: 1,
    activeUsers: 1,
    blockedUsers: 0,
    totalProjects: 0,
    completedProjects: 0,
    totalQuestions: 0,
    totalImages: 0,
    failedJobs: 0,
    totalAiRequests: 0,
    totalAiTokens: 0,
    storageUsedBytes: 0,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Master Admin Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time platform telemetry, user metrics, AI usage, and extraction jobs.
          </p>
        </div>

        <button
          onClick={fetchOverview}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</span>
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-3 font-mono">{stats.totalUsers}</p>
          <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <span>● {stats.activeUsers} Active</span>
            {stats.blockedUsers > 0 && <span className="text-rose-400 ml-2">● {stats.blockedUsers} Blocked</span>}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">PDFs & Projects</span>
            <FolderKanban className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-3 font-mono">{stats.totalProjects}</p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.completedProjects} Completed conversions
          </p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Questions Extracted</span>
            <Layers className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-3 font-mono">{stats.totalQuestions.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.totalImages} diagrams preserved
          </p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Telemetry</span>
            <Cpu className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-3 font-mono">{stats.totalAiRequests}</p>
          <p className="text-xs text-purple-400 mt-1 font-mono">
            {stats.totalAiTokens.toLocaleString()} tokens used
          </p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/ai"
          className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-blue-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-blue-400" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </div>
          <h3 className="text-base font-bold text-white mt-4">AI / OpenRouter Configuration</h3>
          <p className="text-xs text-slate-400 mt-1">
            Update API keys, customize primary & vision models, and review live failover status.
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-indigo-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
          <h3 className="text-base font-bold text-white mt-4">User & Role Management</h3>
          <p className="text-xs text-slate-400 mt-1">
            Manage user accounts, assign admin privileges, and audit usage quotas.
          </p>
        </Link>

        <Link
          href="/admin/jobs"
          className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-purple-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
          </div>
          <h3 className="text-base font-bold text-white mt-4">Processing Jobs Monitor</h3>
          <p className="text-xs text-slate-400 mt-1">
            Live pipeline execution tracker, step-by-step progress, and error logs.
          </p>
        </Link>
      </div>

      {/* Recent Processing Jobs Table */}
      <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span>Recent Processing Jobs</span>
          </h2>
          <Link href="/admin/jobs" className="text-xs text-blue-400 hover:underline">
            View All Jobs →
          </Link>
        </div>

        {data?.recentJobs && data.recentJobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400 uppercase">
                  <th className="pb-3 font-semibold">Job ID</th>
                  <th className="pb-3 font-semibold">Project</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Progress</th>
                  <th className="pb-3 font-semibold">Questions</th>
                  <th className="pb-3 font-semibold">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.recentJobs.map((j: any) => (
                  <tr key={j.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-mono text-xs text-slate-400">{j.id.slice(0, 8)}...</td>
                    <td className="py-3 text-white font-medium">{j.project?.name || 'NEET Paper'}</td>
                    <td className="py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          j.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : j.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs text-slate-300">{j.progress_percentage}%</td>
                    <td className="py-3 font-mono text-xs text-slate-300">{j.questions_processed}</td>
                    <td className="py-3 text-xs text-slate-400">{formatDate(j.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">No processing jobs recorded yet.</p>
        )}
      </div>
    </div>
  );
}
