'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FolderKanban, Search, Trash2, ArrowRight, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Project } from '@/types/database';

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
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
            <FolderKanban className="w-6 h-6 text-blue-400" />
            <span>Master Admin — All Projects</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspect all NEET & JEE extraction projects across the entire system.
          </p>
        </div>

        <button
          onClick={fetchProjects}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 border-b border-white/10 text-xs text-slate-400 uppercase">
              <tr>
                <th className="py-3 px-4 font-semibold">Project Name</th>
                <th className="py-3 px-4 font-semibold">Exam</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Questions</th>
                <th className="py-3 px-4 font-semibold">Created</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {projects.length > 0 ? (
                projects.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">{p.name}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {p.exam_type} {p.year}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          p.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : p.status === 'NEEDS_REVIEW'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-300">{p.total_questions || 0}</td>
                    <td className="py-3 px-4 text-xs text-slate-400">{formatDate(p.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/projects/${p.id}/review`}
                        className="text-xs text-blue-400 hover:underline font-semibold"
                      >
                        Inspect & Review →
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    No projects found in database.
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
