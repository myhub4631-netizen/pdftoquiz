'use client';

import { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function AdminExportsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success && data.projects) {
        setProjects(data.projects.filter((p: any) => p.status === 'COMPLETED' || p.status === 'NEEDS_REVIEW'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <span>Master Admin — Excel Exports</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global repository of all generated Excel question banks.
          </p>
        </div>

        <button
          onClick={fetchProjects}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 border-b border-white/10 text-xs text-slate-400 uppercase">
              <tr>
                <th className="py-3 px-4 font-semibold">Project Name</th>
                <th className="py-3 px-4 font-semibold">Exam</th>
                <th className="py-3 px-4 font-semibold">Total Questions</th>
                <th className="py-3 px-4 font-semibold">Format</th>
                <th className="py-3 px-4 font-semibold">Created</th>
                <th className="py-3 px-4 font-semibold text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {projects.length > 0 ? (
                projects.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">{p.name}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {p.exam_type} {p.year}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-300">{p.total_questions || 0}</td>
                    <td className="py-3 px-4 font-mono text-xs text-emerald-400">.XLSX (Multi-Sheet)</td>
                    <td className="py-3 px-4 text-xs text-slate-400">{formatDate(p.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`/api/projects/${p.id}/export`}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    No exports available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
