'use client';

import { useState } from 'react';
import { User, Mail, Shield, Key, Save, Check } from 'lucide-react';

export default function ProfilePage() {
  const [name, setName] = useState('Master Administrator');
  const [email] = useState('master.admin@questionforge.ai');
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
          <User className="w-6 h-6 text-blue-400" />
          <span>User Profile</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your account credentials and system identity.
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <input
              type="email"
              disabled
              value={email}
              className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Assigned System Role</label>
            <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center gap-2 text-purple-300 text-xs font-semibold">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>MASTER_ADMIN (Full elevated system privileges)</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            {saved ? (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Profile updated
              </span>
            ) : <span />}

            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-glow transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
