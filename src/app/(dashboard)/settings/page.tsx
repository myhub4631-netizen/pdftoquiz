'use client';

import { useState } from 'react';
import { Settings, Moon, Bell, Shield, Save, Check } from 'lucide-react';

export default function UserSettingsPage() {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [autoExport, setAutoExport] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-400" />
          <span>User Preferences & Settings</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure notifications, extraction preferences, and interface theme.
        </p>
      </div>

      <form onSubmit={handleSave} className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6">
        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 cursor-pointer">
            <div>
              <span className="text-sm font-semibold text-white">Email Processing Alerts</span>
              <p className="text-xs text-slate-400">Receive an email when large 200-question papers finish processing.</p>
            </div>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 cursor-pointer">
            <div>
              <span className="text-sm font-semibold text-white">Automatic Excel Export Generation</span>
              <p className="text-xs text-slate-400">Generate .xlsx files immediately upon pipeline completion.</p>
            </div>
            <input
              type="checkbox"
              checked={autoExport}
              onChange={(e) => setAutoExport(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {saved ? (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" /> Preferences saved
            </span>
          ) : <span />}

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-glow transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
}
