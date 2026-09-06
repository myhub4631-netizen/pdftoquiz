'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Save,
  Search,
  Filter,
  Image as ImageIcon,
  Sparkles,
  Layers,
  HelpCircle,
  Trash2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { getConfidenceColor, getSubjectColor } from '@/lib/utils';

export default function HumanReviewEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'needs_review' | 'high_confidence'>('all');
  const [search, setSearch] = useState('');
  const [saveToast, setSaveToast] = useState(false);

  useEffect(() => {
    fetchProjectAndQuestions();
  }, [id]);

  async function fetchProjectAndQuestions() {
    setLoading(true);
    try {
      const [projRes, qRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/questions?limit=250`),
      ]);

      const projData = await projRes.json();
      const qData = await qRes.json();

      if (projData.success) {
        setProject(projData.project);
      }

      if (qData.success && qData.questions && qData.questions.length > 0) {
        setQuestions(qData.questions);
        setSelectedQuestion(qData.questions[0]);
        setSelectedIndex(0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredQuestions = questions.filter((q) => {
    if (filterMode === 'needs_review' && !q.needs_review) return false;
    if (filterMode === 'high_confidence' && (q.confidence || 0) < 85) return false;
    if (search) {
      const matchText = (q.question_text || '').toLowerCase().includes(search.toLowerCase());
      const matchNum = q.question_number?.toString() === search.trim();
      const matchSub = (q.subject || '').toLowerCase().includes(search.toLowerCase());
      return matchText || matchNum || matchSub;
    }
    return true;
  });

  function selectQuestionByIndex(idx: number) {
    if (idx >= 0 && idx < filteredQuestions.length) {
      setSelectedIndex(idx);
      setSelectedQuestion(filteredQuestions[idx]);
    }
  }

  async function handleSaveCurrentQuestion() {
    if (!selectedQuestion) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/questions/${selectedQuestion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedQuestion),
      });
      const data = await res.json();
      if (data.success) {
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 2000);

        // Update local list
        setQuestions((prev) =>
          prev.map((q) => (q.id === selectedQuestion.id ? { ...q, ...selectedQuestion } : q))
        );
      }
    } catch (err) {
      console.error('Failed to save question', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${id}/export`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to generate Excel file.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || 'QuestionBank'}_Export.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error generating Excel export.');
    } finally {
      setExporting(false);
    }
  }

  function handleOptionChange(optIndex: number, newText: string) {
    if (!selectedQuestion) return;
    const updatedOptions = [...(selectedQuestion.question_options || [])];
    if (updatedOptions[optIndex]) {
      updatedOptions[optIndex] = { ...updatedOptions[optIndex], option_text: newText };
      setSelectedQuestion({ ...selectedQuestion, question_options: updatedOptions });
    }
  }

  if (loading && !project) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading Human Review Editor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}`}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white line-clamp-1">
                {project?.name || 'Review Questions'}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {project?.exam_type}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Total {questions.length} questions extracted • {project?.needs_review_count || 0} flagged for review
            </p>
          </div>
        </div>

        {/* Export to Excel Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-glow disabled:opacity-50 transition-all"
          >
            <Download className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} />
            <span>{exporting ? 'Compiling Multi-Sheet Excel...' : 'Export Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="fixed top-20 right-8 z-50 p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Question #{selectedQuestion?.question_number} saved &amp; updated.</span>
        </div>
      )}

      {/* Split Human Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Question Index & Filters (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search question # or text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilterMode('all')}
                className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  filterMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({questions.length})
              </button>
              <button
                onClick={() => setFilterMode('needs_review')}
                className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  filterMode === 'needs_review'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                Needs Review
              </button>
              <button
                onClick={() => setFilterMode('high_confidence')}
                className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  filterMode === 'high_confidence'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                High Conf
              </button>
            </div>
          </div>

          {/* Questions Scrollable List */}
          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
            <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-800/60">
              {filteredQuestions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No questions match your current filter.
                </div>
              ) : (
                filteredQuestions.map((q, idx) => {
                  const isSelected = selectedQuestion?.id === q.id;
                  const conf = q.confidence ?? 90;

                  return (
                    <button
                      key={q.id}
                      onClick={() => selectQuestionByIndex(idx)}
                      className={`w-full text-left p-3.5 transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-600/20 border-l-4 border-l-blue-500'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            Q{q.question_number}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${getSubjectColor(q.subject || 'General')}`}>
                            {q.subject || 'General'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2">
                          {q.question_text || 'No question text extracted.'}
                        </p>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-bold ${getConfidenceColor(conf)}`}>
                          {conf}%
                        </span>
                        {q.needs_review && (
                          <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">
                            Review
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Active Question Editor (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedQuestion ? (
            <div className="glass-card rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-6">
              {/* Question Header & Navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 rounded-xl bg-blue-600 font-mono text-sm font-bold text-white items-center justify-center shadow-glow">
                    {selectedQuestion.question_number}
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Question Editor #{selectedQuestion.question_number}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Confidence: <span className="font-mono text-emerald-400 font-semibold">{selectedQuestion.confidence || 95}%</span>
                      {selectedQuestion.review_reason && ` • ${selectedQuestion.review_reason}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectQuestionByIndex(selectedIndex - 1)}
                    disabled={selectedIndex <= 0}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedIndex + 1} of {filteredQuestions.length}
                  </span>
                  <button
                    onClick={() => selectQuestionByIndex(selectedIndex + 1)}
                    disabled={selectedIndex >= filteredQuestions.length - 1}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Subject, Chapter & Type Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Subject</label>
                  <input
                    type="text"
                    value={selectedQuestion.subject || ''}
                    onChange={(e) => setSelectedQuestion({ ...selectedQuestion, subject: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Chapter / Topic</label>
                  <input
                    type="text"
                    value={selectedQuestion.chapter || ''}
                    onChange={(e) => setSelectedQuestion({ ...selectedQuestion, chapter: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Question Type</label>
                  <select
                    value={selectedQuestion.question_type || 'single_correct'}
                    onChange={(e) => setSelectedQuestion({ ...selectedQuestion, question_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="single_correct">Single Correct</option>
                    <option value="multiple_correct">Multiple Correct</option>
                    <option value="assertion_reason">Assertion &amp; Reason</option>
                    <option value="numerical">Numerical / Integer</option>
                    <option value="match_the_following">Match the Following</option>
                    <option value="image_based">Image Based</option>
                  </select>
                </div>
              </div>

              {/* Question Text Editor */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Question Statement / Problem Text</span>
                  <span className="text-[11px] text-slate-500">LaTeX / Formulas preserved</span>
                </label>
                <textarea
                  rows={4}
                  value={selectedQuestion.question_text || ''}
                  onChange={(e) => setSelectedQuestion({ ...selectedQuestion, question_text: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                />
              </div>

              {/* Attached Images Preview (Diagrams) */}
              {selectedQuestion.question_images && selectedQuestion.question_images.length > 0 && (
                <div className="space-y-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-blue-400" />
                    <span>Attached Diagram / Visual Asset</span>
                  </label>
                  <div className="flex gap-4 overflow-x-auto py-2">
                    {selectedQuestion.question_images.map((img: any) => (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-950 p-2">
                        <img
                          src={img.storage_path_optimized || img.storage_path_original || '/placeholder.png'}
                          alt="Question Diagram"
                          className="max-h-36 max-w-xs object-contain rounded"
                        />
                        <span className="text-[10px] text-slate-400 block mt-1 text-center font-mono">
                          {img.image_type || 'diagram'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options A, B, C, D */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300">
                  Multiple Choice Options
                </label>
                <div className="space-y-2.5">
                  {(selectedQuestion.question_options || []).map((opt: any, optIdx: number) => {
                    const isCorrect = selectedQuestion.answer === opt.option_label || selectedQuestion.answer === opt.option_text;

                    return (
                      <div
                        key={opt.id || optIdx}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isCorrect
                            ? 'bg-emerald-950/30 border-emerald-500/40'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedQuestion({ ...selectedQuestion, answer: opt.option_label })}
                          className={`flex h-7 w-7 rounded-lg font-mono text-xs font-bold items-center justify-center transition-colors ${
                            isCorrect
                              ? 'bg-emerald-500 text-slate-950 shadow-glow'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {opt.option_label}
                        </button>
                        <input
                          type="text"
                          value={opt.option_text || ''}
                          onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Answer & Needs Review Flag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Correct Answer Key
                  </label>
                  <input
                    type="text"
                    value={selectedQuestion.answer || ''}
                    onChange={(e) => setSelectedQuestion({ ...selectedQuestion, answer: e.target.value })}
                    placeholder="e.g. A, B, or Numerical"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!selectedQuestion.needs_review}
                      onChange={(e) => setSelectedQuestion({ ...selectedQuestion, needs_review: !e.target.checked })}
                      className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      Marked as Verified &amp; Ready
                    </span>
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  onClick={handleSaveCurrentQuestion}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-glow transition-all"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Saving...' : 'Save Question'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-16 text-center text-slate-500">
              Select a question from the left panel to review and edit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
