'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  PlusCircle,
  FileSpreadsheet,
  FileQuestion,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  UploadCloud,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function UserDashboardPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
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
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.exam_type && p.exam_type.toLowerCase().includes(search.toLowerCase()))
  );

  const totalQuestions = projects.reduce((acc, p) => acc + (p.extracted_questions || 0), 0);
  const totalCompleted = projects.filter((p) => p.status === 'COMPLETED').length;
  const totalNeedsReview = projects.reduce((acc, p) => acc + (p.needs_review_count || 0), 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-6 sm:p-8 border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>NEET (180/200) &amp; JEE Exam Paper Converter</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Transform Question Paper PDFs into Formatted Excel
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Extract questions, mathematical expressions, scientific diagrams, and options images directly into structured multi-sheet Excel files.
            </p>
          </div>

          <Link
            href="/projects/new"
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-glow hover:scale-[1.02] transition-all shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Upload New PDF</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Projects</span>
            <FolderKanban className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{projects.length}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Questions Extracted</span>
            <FileQuestion className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-300 font-mono">{totalQuestions}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Completed Papers</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono">{totalCompleted}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Needs Review</span>
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 font-mono">{totalNeedsReview}</p>
        </div>
      </div>

      {/* Projects List Section */}
      <div id="projects" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Your Question Papers</h2>
            <p className="text-xs text-slate-400">View and manage uploaded PDF question papers.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search papers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center space-y-4 border border-slate-800">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">No question paper uploaded yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload a NEET or JEE PDF question paper to automatically extract questions and diagrams.
              </p>
            </div>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-glow"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create First Project</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col justify-between space-y-4 border border-slate-800"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {project.exam_type}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        project.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : project.status === 'NEEDS_REVIEW'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white line-clamp-1">
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {project.description || `${project.exam_type} Question Paper • ${project.year}`}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Questions Extracted</span>
                    <span className="font-mono text-white font-semibold">
                      {project.extracted_questions} / {project.expected_questions}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/projects/${project.id}/review`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-glow transition-all"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Review &amp; Export</span>
                    </Link>
                    <Link
                      href={`/projects/${project.id}`}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors"
                    >
                      Status
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
