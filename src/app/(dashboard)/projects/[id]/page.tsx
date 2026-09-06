'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function ProjectStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [id]);

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      if (data.success) {
        setProject(data.project);
        setJob(data.job);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReprocess() {
    setLoading(true);
    try {
      await fetch(`/api/projects/${id}/process`, { method: 'POST' });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading && !project) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading project telemetry...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-24 text-center space-y-3">
        <p className="text-sm text-rose-400">Project not found.</p>
        <Link href="/dashboard" className="text-xs text-blue-400 underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const isFinished = project.status === 'COMPLETED' || project.status === 'NEEDS_REVIEW';
  const progressPercent = job?.progress || (isFinished ? 100 : 45);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {project.exam_type}
            </span>
            <span className="text-xs text-slate-400 font-mono">ID: {project.id.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            {project.name}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Uploaded on {formatDate(project.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${project.id}/review`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-glow transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Open Question Reviewer</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Live Pipeline Status Banner */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-400" />
              Pipeline Execution Status
            </h2>
            <p className="text-xs text-slate-400">
              {job?.step_name || 'Extracting questions and formatting diagrams...'}
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isFinished
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
            }`}
          >
            {isFinished ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-blue-400 animate-spin" />
            )}
            <span>{project.status}</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
            <div
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-400 h-full rounded-full transition-all duration-500 shadow-glow"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Progress: {progressPercent}%</span>
            <span>Target: {project.expected_questions} Questions</span>
          </div>
        </div>

        {/* Extraction Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400">Extracted</p>
            <p className="text-xl font-bold font-mono text-white">{project.extracted_questions}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400">Expected</p>
            <p className="text-xl font-bold font-mono text-slate-300">{project.expected_questions}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400">Needs Review</p>
            <p className="text-xl font-bold font-mono text-amber-400">{project.needs_review_count || 0}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400">Exam Code</p>
            <p className="text-xl font-bold font-mono text-blue-400">{project.exam_type}</p>
          </div>
        </div>
      </div>

      {/* Next Step Action CTA */}
      <div className="p-6 rounded-2xl glass-card border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-sm font-bold text-white">Ready to inspect and export to Excel?</h3>
          <p className="text-xs text-slate-400">
            Review questions side-by-side, verify diagrams, and download formatted multi-sheet .xlsx.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReprocess}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors"
          >
            Re-run Pipeline
          </button>
          <Link
            href={`/projects/${project.id}/review`}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold shadow-glow hover:scale-105 transition-all"
          >
            <span>Launch Human Review Editor</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
