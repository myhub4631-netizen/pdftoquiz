'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Image as ImageIcon,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function ProjectStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Status & Telemetry State
  const [project, setProject] = useState<any>(null);
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Worker Loop Control State
  const [isPaused, setIsPaused] = useState(false);
  const [isWorkerRunning, setIsWorkerRunning] = useState(false);
  const [currentProcessingPage, setCurrentProcessingPage] = useState<number | null>(null);
  const isWorkerRef = useRef(false);
  const isPausedRef = useRef(false);

  // Keep refs synced with state for loop condition checking
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    fetchProjectAndStatus();
  }, [id]);

  // Initial load and auto-start worker loop
  async function fetchProjectAndStatus() {
    try {
      const projRes = await fetch(`/api/projects/${id}`);
      const projJson = await projRes.json();

      if (projJson.success && projJson.project) {
        setProject(projJson.project);
      }

      const statusRes = await fetch(`/api/projects/${id}/processing-status`);
      const statusJson = await statusRes.json();

      if (statusJson.success) {
        setStatusData(statusJson);

        // If pages haven't been initiated yet, trigger initiate-parse
        if (statusJson.totalPages === 0 && projJson.project?.status !== 'COMPLETED' && projJson.project?.status !== 'NEEDS_REVIEW') {
          await initiateParse();
        } else if (statusJson.firstIncompletePage !== null && !isWorkerRef.current && !isPausedRef.current) {
          // Auto-start worker loop if incomplete pages remain
          startWorkerLoop();
        }
      }
    } catch (err: any) {
      console.error('[ProjectStatusPage] Error loading status:', err);
      setError(err?.message || 'Failed to load project status');
    } finally {
      setLoading(false);
    }
  }

  // Trigger initiate parse endpoint
  async function initiateParse() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${id}/initiate-parse`, { method: 'POST' });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate parse');
      }

      // Refresh status and start worker
      await refreshStatus();
      startWorkerLoop();
    } catch (err: any) {
      setError(err?.message || 'Initiate parse failed');
    } finally {
      setLoading(false);
    }
  }

  // Fetch updated status JSON from Supabase
  async function refreshStatus() {
    try {
      const res = await fetch(`/api/projects/${id}/processing-status`);
      const data = await res.json();
      if (data.success) {
        setStatusData(data);
        return data;
      }
    } catch (err) {
      console.error('[refreshStatus] Error:', err);
    }
    return null;
  }

  // Main Worker Loop: Processes pages 1-by-1 using Supabase as source of truth
  async function startWorkerLoop() {
    if (isWorkerRef.current) return;

    isWorkerRef.current = true;
    setIsWorkerRunning(true);
    setError(null);

    try {
      while (isWorkerRef.current && !isPausedRef.current) {
        const currentStatus = await refreshStatus();

        if (!currentStatus || currentStatus.totalPages === 0) {
          break;
        }

        const nextPageNum = currentStatus.firstIncompletePage;

        // All pages completed! Trigger finalization
        if (nextPageNum === null) {
          setCurrentProcessingPage(null);
          await finalizeProject();
          break;
        }

        // Check if next page is currently in FAILED state and user paused
        const nextPageObj = currentStatus.pages.find((p: any) => p.pageNumber === nextPageNum);
        if (nextPageObj?.status === 'FAILED' && isPausedRef.current) {
          break;
        }

        setCurrentProcessingPage(nextPageNum);

        // Call process-page endpoint for EXACTLY ONE PAGE
        const procRes = await fetch(`/api/projects/${id}/process-page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageNumber: nextPageNum }),
        });

        const procData = await procRes.json();

        if (!procData.success) {
          console.warn(`[WorkerLoop] Page ${nextPageNum} returned failure:`, procData.error);
          await refreshStatus();
          // Pause worker on page failure to allow user to retry
          setIsPaused(true);
          isPausedRef.current = true;
          break;
        }

        // Delay briefly before next page
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (loopErr: any) {
      console.error('[WorkerLoop] Fatal error:', loopErr);
      setError(loopErr?.message || 'Worker process loop encountered an error');
    } finally {
      isWorkerRef.current = false;
      setIsWorkerRunning(false);
      setCurrentProcessingPage(null);
      await refreshStatus();
    }
  }

  // Finalize Project: generate Excel & update project status
  async function finalizeProject() {
    try {
      const res = await fetch(`/api/projects/${id}/finalize`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        const projRes = await fetch(`/api/projects/${id}`);
        const projJson = await projRes.json();
        if (projJson.success && projJson.project) {
          setProject(projJson.project);
        }
      } else {
        setError(data.error || 'Finalization failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Finalization error');
    }
  }

  // User Control Actions
  function handlePause() {
    setIsPaused(true);
    isPausedRef.current = true;
  }

  function handleResume() {
    setIsPaused(false);
    isPausedRef.current = false;
    startWorkerLoop();
  }

  async function handleRetryFailed() {
    if (!statusData?.pages) return;
    const failedPages = statusData.pages.filter((p: any) => p.status === 'FAILED');
    setIsPaused(false);
    isPausedRef.current = false;

    // Trigger retry for failed pages
    for (const fp of failedPages) {
      await fetch(`/api/projects/${id}/process-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageNumber: fp.pageNumber, retry: true }),
      });
    }

    startWorkerLoop();
  }

  if (loading && !project) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading project processing telemetry...</p>
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
  const totalPages = statusData?.totalPages || project.total_pages || 1;
  const completedPages = statusData?.completedPages || 0;
  const failedPages = statusData?.failedPages || 0;
  const progressPercent = statusData?.progressPercentage || (isFinished ? 100 : 0);
  const questionsDetected = statusData?.totalQuestionsDetected || project.extracted_questions || 0;
  const imagesDetected = statusData?.totalImagesDetected || 0;

  const currentDisplayPage = currentProcessingPage || statusData?.firstIncompletePage || Math.min(completedPages + 1, totalPages);

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

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => { setError(null); startWorkerLoop(); }}
            className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 rounded text-[11px] font-semibold text-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Live Resumable Pipeline Card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-400" />
              Resumable Page-by-Page Pipeline
            </h2>
            <p className="text-xs text-slate-400">
              {isFinished
                ? 'Processing completed! All pages extracted & verified.'
                : `Processing Page ${currentDisplayPage} of ${totalPages}`}
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isFinished
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isWorkerRunning
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {isFinished ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : isWorkerRunning ? (
              <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" />
            ) : (
              <Pause className="h-3.5 w-3.5 text-amber-400" />
            )}
            <span>{isFinished ? project.status : isWorkerRunning ? 'PROCESSING' : 'PAUSED'}</span>
          </span>
        </div>

        {/* Progress Bar Display: Processing Page 14 of 25  ██████████████░░░░░░ 56% */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-300">
            <span>
              Processing Page {completedPages} of {totalPages}
            </span>
            <span className="font-bold text-blue-400">{progressPercent}%</span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden border border-slate-800 p-0.5">
            <div
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-400 h-full rounded-full transition-all duration-300 shadow-glow"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Live Counters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400">Questions detected</p>
            <p className="text-xl font-bold font-mono text-white">{questionsDetected}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400">Images detected</p>
            <p className="text-xl font-bold font-mono text-cyan-400">{imagesDetected}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400">Failed pages</p>
            <p className={`text-xl font-bold font-mono ${failedPages > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {failedPages}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <p className="text-[11px] text-slate-400">Target Questions</p>
            <p className="text-xl font-bold font-mono text-slate-300">{project.expected_questions}</p>
          </div>
        </div>

        {/* Pipeline Control Buttons */}
        {!isFinished && (
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800/80">
            {isWorkerRunning && !isPaused ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all"
              >
                <Pause className="h-4 w-4" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-glow transition-all"
              >
                <Play className="h-4 w-4" />
                <span>{completedPages > 0 ? 'Resume Processing' : 'Continue Processing'}</span>
              </button>
            )}

            {failedPages > 0 && (
              <button
                onClick={handleRetryFailed}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry Failed ({failedPages})</span>
              </button>
            )}

            <button
              onClick={() => initiateParse()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset &amp; Restart</span>
            </button>
          </div>
        )}

        {/* Resumable Page Grid Breakdown */}
        {statusData?.pages && statusData.pages.length > 0 && (
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Page Matrix Status (Supabase Source of Truth)
            </h3>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {statusData.pages.map((p: any) => {
                const isCompleted = p.status === 'COMPLETED';
                const isFailed = p.status === 'FAILED';
                const isProcessing = currentProcessingPage === p.pageNumber || p.status === 'PROCESSING';

                return (
                  <div
                    key={p.pageNumber}
                    title={`Page ${p.pageNumber}: ${p.status}${p.errorMessage ? ` - ${p.errorMessage}` : ''}`}
                    className={`p-2 rounded-lg text-center border transition-all ${
                      isCompleted
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                        : isFailed
                        ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                        : isProcessing
                        ? 'bg-blue-950/60 border-blue-500/50 text-blue-300 animate-pulse'
                        : 'bg-slate-900/50 border-slate-800 text-slate-500'
                    }`}
                  >
                    <p className="text-[10px] font-mono font-bold">P{p.pageNumber}</p>
                    <p className="text-[9px] mt-0.5">
                      {isCompleted ? `✓ ${p.questionsCount}Q` : isFailed ? '✕' : isProcessing ? '...' : 'QUEUED'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Next Step CTA */}
      <div className="p-6 rounded-2xl glass-card border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-sm font-bold text-white">Inspect extracted questions and download Excel?</h3>
          <p className="text-xs text-slate-400">
            Review questions side-by-side, verify diagrams, and export formatted multi-sheet .xlsx.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
