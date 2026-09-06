'use client';

import { useState } from 'react';
import { Settings, Save, Sparkles, Check } from 'lucide-react';

export default function AdminSettingsPage() {
  const [appName, setAppName] = useState('QuestionForge AI');
  const [supportEmail, setSupportEmail] = useState('support@questionforge.ai');
  const [allowPublicSignup, setAllowPublicSignup] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-400" />
          <span>System & Branding Settings</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure application name, support contact, and global branding.
        </p>
      </div>

      <form onSubmit={handleSave} className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Application Name</label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">Configurable branding name shown throughout header and metadata.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Support Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 cursor-pointer">
            <div>
              <span className="text-sm font-semibold text-white">Allow Public Registrations</span>
              <p className="text-xs text-slate-400">When disabled, only invited users can access the platform.</p>
            </div>
            <input
              type="checkbox"
              checked={allowPublicSignup}
              onChange={(e) => setAllowPublicSignup(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {saved ? (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" /> Settings updated
            </span>
          ) : <span />}

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-glow transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Branding Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
