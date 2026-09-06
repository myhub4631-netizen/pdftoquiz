'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, Download, RefreshCw, FolderKanban } from 'lucide-react';
import { formatDate, formatBytes } from '@/lib/utils';

export default function ExportsHistoryPage() {
  const [exportsList, setExportsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For demo/production, load recent projects with available export files
    fetchExports();
  }, []);

  const fetchExports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success && data.projects) {
        setExportsList(data.projects.filter((p: any) => p.status === 'COMPLETED' || p.status === 'NEEDS_REVIEW'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <span>Excel Export History</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Download your formatted Excel question banks with embedded diagrams and metadata reports.
          </p>
        </div>

        <button
          onClick={fetchExports}
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
                <th className="py-3.5 px-4 font-semibold">Project / Paper</th>
                <th className="py-3.5 px-4 font-semibold">Exam Type</th>
                <th className="py-3.5 px-4 font-semibold">Questions</th>
                <th className="py-3.5 px-4 font-semibold">Format</th>
                <th className="py-3.5 px-4 font-semibold">Last Processed</th>
                <th className="py-3.5 px-4 font-semibold text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {exportsList.length > 0 ? (
                exportsList.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.year} Exam Paper</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {p.exam_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-300">{p.total_questions || 0}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                        .XLSX (3 Sheets)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">{formatDate(p.updated_at || p.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`/api/projects/${p.id}/export`}
                        download
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-all shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download XLSX</span>
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-slate-500">
                    No completed project exports available yet.
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
