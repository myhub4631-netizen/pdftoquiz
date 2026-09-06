import React from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Sparkles,
  ArrowRight,
  Layers,
  Zap,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Image as ImageIcon,
  Cpu,
  Eye,
  DownloadCloud,
  ChevronRight,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-600/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/75 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 shadow-glow">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                QuestionForge <span className="text-blue-400">AI</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">NEET &amp; JEE Question Engine</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/ai"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <Cpu className="h-3.5 w-3.5 text-blue-400" />
              <span>Admin AI Portal</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-glow hover:scale-[1.02] transition-all"
            >
              <span>Open App</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-cyan-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
          <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span>Full 180 &amp; 200 NEET Permutation Detection + Diagram Cell Embedding</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Turn Complex NEET &amp; JEE PDFs into{' '}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Excel Question Banks
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          The ultimate AI processor for high-stakes test papers. Extracts multi-choice questions, mathematical formulas, LaTeX symbols, and embeds physical diagram images directly into structured 3-sheet Excel workbooks.
        </p>

        {/* Hero CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-glow hover:scale-[1.03] transition-all"
          >
            <Zap className="h-4 w-4" />
            <span>Launch Dashboard</span>
          </Link>

          <Link
            href="/projects/new"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-white font-semibold text-sm hover:scale-[1.02] transition-all backdrop-blur-md"
          >
            <UploadCloud className="h-4 w-4 text-blue-400" />
            <span>Upload Question PDF</span>
          </Link>
        </div>

        {/* Badges / Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-10">
          <div className="glass-card p-4 rounded-2xl border border-slate-800/80">
            <p className="text-2xl font-bold font-mono text-cyan-400">180 &amp; 200</p>
            <p className="text-xs text-slate-400 font-medium">NEET Question Schemes</p>
          </div>
          <div className="glass-card p-4 rounded-2xl border border-slate-800/80">
            <p className="text-2xl font-bold font-mono text-blue-400">6 Permutations</p>
            <p className="text-xs text-slate-400 font-medium">Dynamic Subject Routing</p>
          </div>
          <div className="glass-card p-4 rounded-2xl border border-slate-800/80">
            <p className="text-2xl font-bold font-mono text-indigo-400">100% Sliced</p>
            <p className="text-xs text-slate-400 font-medium">Sharp WebP Cell Embedding</p>
          </div>
          <div className="glass-card p-4 rounded-2xl border border-slate-800/80">
            <p className="text-2xl font-bold font-mono text-emerald-400">&lt; 200ms</p>
            <p className="text-xs text-slate-400 font-medium">Excel Compilation Speed</p>
          </div>
        </div>
      </section>

      {/* Feature Architecture Showcase */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Engine Capabilities</span>
          <h2 className="text-3xl font-extrabold text-white">Built Specifically for NEET &amp; JEE Exams</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Handle complex question formats, multi-part questions, and subject permutations without manual re-typing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800/80 space-y-4 hover:border-blue-500/40 transition-colors">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Dynamic NEET Permutation</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Automatically identifies whether a paper is 180 questions or 200 questions (Sec A + Sec B) and classifies any order: Physics ➔ Chemistry ➔ Biology or Biology ➔ Chemistry ➔ Physics.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 pt-2 border-t border-slate-800/80">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Physics (45 / 50 questions)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Chemistry (45 / 50 questions)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Botany &amp; Zoology (90 / 100 questions)</span>
              </li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800/80 space-y-4 hover:border-indigo-500/40 transition-colors">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ImageIcon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Embedded Cell Images</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Binary stream XObject slicer extracts circuit diagrams, organic chemistry structures, and biology anatomical figures, compressing them to WebP and physically embedding them inside Excel cells.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 pt-2 border-t border-slate-800/80">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Sharp WebP 80% compression</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Option diagram mapping (A, B, C, D)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Exact oneCell Excel coordinate anchoring</span>
              </li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800/80 space-y-4 hover:border-cyan-500/40 transition-colors">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Eye className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Split Human Review Editor</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Side-by-side interactive verification interface allowing operators to inspect the original PDF page next to extracted questions, edit choices, verify confidence scores, and approve with 1 click.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 pt-2 border-t border-slate-800/80">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Split PDF vs Form editor</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Confidence badge highlight (&lt;85%)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Immediate 3-Sheet Excel Export</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-[10px]">
            QF
          </div>
          <span className="font-semibold text-slate-200">QuestionForge AI Engine</span>
          <span>• Production v1.0.0</span>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            User Dashboard
          </Link>
          <Link href="/projects/new" className="hover:text-white transition-colors">
            Upload PDF
          </Link>
          <Link href="/admin/ai" className="hover:text-white transition-colors">
            Master Admin AI
          </Link>
        </div>
      </footer>
    </div>
  );
}

function UploadCloud(props: any) {
  return <DownloadCloud {...props} className={props.className + " rotate-180"} />;
}
