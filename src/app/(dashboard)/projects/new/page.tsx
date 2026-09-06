'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  Sparkles,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ArrowRight,
} from 'lucide-react';

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [examType, setExamType] = useState('NEET');
  const [year, setYear] = useState(2025);
  const [subjectFocus, setSubjectFocus] = useState('ALL');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Image Settings State
  const [extractImages, setExtractImages] = useState(true);
  const [compressImages, setCompressImages] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState<'Original' | 'Low' | 'Medium' | 'High' | 'Maximum'>('Medium');
  const [convertToSvg, setConvertToSvg] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(false);

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (selected.type === 'application/pdf' || selected.name.endsWith('.pdf')) {
        setFile(selected);
        if (!name) {
          setName(selected.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        setError('Please upload a valid PDF file.');
      }
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!name) {
        setName(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name || 'NEET/JEE Question Paper');
      formData.append('exam_type', examType);
      formData.append('year', year.toString());
      formData.append('subject_focus', subjectFocus);
      formData.append('description', description);
      formData.append('extract_images', extractImages.toString());
      formData.append('compress_images', compressImages.toString());
      formData.append('compression_level', compressionLevel);
      formData.append('convert_to_svg', convertToSvg.toString());
      formData.append('keep_original_images', keepOriginal.toString());

      if (file) {
        formData.append('file', file);
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create project.');
      }

      // Automatically trigger processing pipeline
      await fetch(`/api/projects/${data.project.id}/process`, { method: 'POST' });

      router.push(`/projects/${data.project.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Title */}
      <div className="border-b border-slate-800/80 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <UploadCloud className="h-6 w-6 text-blue-400" />
          Create New Question Paper Project
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload your NEET or JEE question paper PDF to start automated extraction and structured Excel generation.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: File Upload Dropzone */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-5 w-5 rounded-full bg-blue-600 text-white text-[11px] items-center justify-center font-mono">1</span>
            Upload PDF Document
          </h2>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-2xl p-8 text-center bg-slate-900/40 hover:bg-slate-900/60 transition-all cursor-pointer relative"
          >
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <FileText className="h-8 w-8" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • PDF Ready
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    Drag and drop your NEET / JEE PDF here, or <span className="text-blue-400 underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports 180 or 200 question NEET papers &amp; JEE Mains/Advanced sets (Up to 50MB)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Paper Metadata & Exam Profile */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-5 w-5 rounded-full bg-blue-600 text-white text-[11px] items-center justify-center font-mono">2</span>
            Exam Configuration &amp; Metadata
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Project / Paper Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. NEET 2024 Question Paper - Code Q1"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Exam Type
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="NEET">NEET (180 / 200 Questions)</option>
                <option value="JEE_MAIN">JEE Main (90 Questions)</option>
                <option value="JEE_ADVANCED">JEE Advanced (Paper 1 &amp; 2)</option>
                <option value="OTHER">General Science / CBSE</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Exam Year
              </label>
              <input
                type="number"
                min="2000"
                max="2030"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Subject Focus
              </label>
              <select
                value={subjectFocus}
                onChange={(e) => setSubjectFocus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Subjects (Physics, Chemistry, Biology/Math)</option>
                <option value="PHYSICS">Physics Only</option>
                <option value="CHEMISTRY">Chemistry Only</option>
                <option value="BIOLOGY">Biology Only (Botany + Zoology)</option>
                <option value="MATHEMATICS">Mathematics Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Image Extraction & Compression Engine */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-5 w-5 rounded-full bg-blue-600 text-white text-[11px] items-center justify-center font-mono">3</span>
            Image &amp; Diagram Processing Settings
          </h2>

          <div className="space-y-4">
            {/* Extract Diagrams Toggle */}
            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-white">Extract Diagram &amp; Option Images</p>
                <p className="text-[11px] text-slate-400">
                  Isolate scientific diagrams and option visual choices and attach them to questions.
                </p>
              </div>
              <input
                type="checkbox"
                checked={extractImages}
                onChange={(e) => setExtractImages(e.target.checked)}
                className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
              />
            </label>

            {/* Compress Images Toggle & Level */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-white">Compress &amp; Optimize Images</p>
                  <p className="text-[11px] text-slate-400">
                    Use Sharp to optimize resolution for embedding in Excel workbooks.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={compressImages}
                  onChange={(e) => setCompressImages(e.target.checked)}
                  className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                />
              </div>

              {compressImages && (
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Compression Level:</span>
                  <div className="flex gap-2">
                    {(['Original', 'Low', 'Medium', 'High', 'Maximum'] as const).map((level) => (
                      <button
                        type="button"
                        key={level}
                        onClick={() => setCompressionLevel(level)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          compressionLevel === level
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Vectorize to SVG */}
            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-white">Vectorize Line Art to SVG</p>
                <p className="text-[11px] text-slate-400">
                  Convert clean circuit diagrams and chemical bonds into scalable SVG via Potrace.
                </p>
              </div>
              <input
                type="checkbox"
                checked={convertToSvg}
                onChange={(e) => setConvertToSvg(e.target.checked)}
                className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 rounded-xl bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-glow disabled:opacity-50 transition-all"
          >
            <Sparkles className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Initiating Pipeline...' : 'Start Extraction Pipeline'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
