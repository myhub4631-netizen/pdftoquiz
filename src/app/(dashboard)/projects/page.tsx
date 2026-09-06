'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Search,
  Plus,
  Trash2,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Project } from '@/types/database';

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState('ALL');
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will delete all extracted questions, images, and Excel exports.`)) {
      return;
    }
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filtered = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesExam = examFilter === 'ALL' || p.exam_type === examFilter;
    return matchesSearch && matchesExam;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-blue-400" />
            <span>Question Paper Projects</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Access and manage your extracted NEET & JEE question banks.
          </p>
        </div>

        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-glow transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Upload New PDF</span>
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Exam Types</option>
            <option value="NEET">NEET</option>
            <option value="JEE_MAIN">JEE Main</option>
            <option value="JEE_ADVANCED">JEE Advanced</option>
            <option value="OTHER">Other</option>
          </select>

          <button
            onClick={fetchProjects}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {project.exam_type} {project.year}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      project.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : project.status === 'NEEDS_REVIEW'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse'
                    }`}
                  >
                    ● {project.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mt-3 line-clamp-1">{project.name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {project.total_questions || 0} Questions • {project.total_pages || 1} Pages
                </p>
                {project.needs_review_count > 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠ {project.needs_review_count} questions recommended for review
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-500">{formatDate(project.created_at)}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link
                    href={`/projects/${project.id}/review`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 transition-colors"
                  >
                    <span>Open Editor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-12 text-center border border-white/10 space-y-3">
          <FolderKanban className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No projects found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search ? 'Try adjusting your search filters.' : 'Upload your first NEET/JEE question paper PDF to get started.'}
          </p>
        </div>
      )}
    </div>
  );
}
