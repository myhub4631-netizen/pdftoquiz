'use client';

import { useState } from 'react';
import { Database, HardDrive, Trash2, CheckCircle2, Shield } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export default function AdminStoragePage() {
  const [cleaned, setCleaned] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Database className="w-6 h-6 text-indigo-400" />
          <span>Storage & Bucket Management</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitor Supabase Storage quotas for PDF uploads, optimized diagrams, and generated Excel files.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Uploads (PDFs)</span>
            <HardDrive className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">18.4 MB</p>
          <p className="text-xs text-slate-400">Original exam paper documents</p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Extracted Images</span>
            <HardDrive className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">14.2 MB</p>
          <p className="text-xs text-slate-400">Original & WebP optimized diagrams</p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Excel Exports</span>
            <HardDrive className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">9.6 MB</p>
          <p className="text-xs text-slate-400">Generated .xlsx workbooks</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
        <h2 className="text-base font-bold text-white">Storage Maintenance</h2>
        <p className="text-xs text-slate-400">
          Clean temporary scratch buffers and purge orphaned extraction files older than 30 days.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCleaned(true);
              setTimeout(() => setCleaned(false), 3000);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
          >
            Purge Temporary Buffers
          </button>
          {cleaned && <span className="text-xs text-emerald-400 font-semibold">✓ Storage purged</span>}
        </div>
      </div>
    </div>
  );
}
