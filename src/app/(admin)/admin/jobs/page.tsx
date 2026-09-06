'use client';

import React, { useEffect, useState } from 'react';
import { Cpu, RefreshCw, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/jobs');
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu className="h-6 w-6 text-amber-400" />
            Processing Jobs Monitor
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time execution telemetry for PDF parsing, image extraction, and AI structuring jobs.
          </p>
        </div>

        <button
          onClick={fetchJobs}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-3.5">Job / Step</th>
                <th className="px-6 py-3.5">Project</th>
                <th className="px-6 py-3.5">Model Used</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Progress</th>
                <th className="px-6 py-3.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No processing jobs currently logged.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white font-mono">{j.step_name}</div>
                      <div className="text-slate-400 font-mono text-[10px]">ID: {j.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-200">{j.projects?.name || 'NEET/JEE Paper'}</div>
                      <div className="text-slate-400 text-[10px]">{j.projects?.exam_type || 'NEET'}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {j.model_used || 'google/gemini-2.5-flash'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          j.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : j.status === 'running'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {j.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                        {j.status === 'running' && <Clock className="h-3 w-3 animate-spin" />}
                        {j.status === 'failed' && <XCircle className="h-3 w-3" />}
                        {j.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${j.progress || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{j.progress || 0}%</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{formatDate(j.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
