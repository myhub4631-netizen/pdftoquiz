import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(dateStr: string | Date) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getConfidenceColor(confidence: number) {
  if (confidence >= 85) return 'text-emerald-400 bg-emerald-950/50 border-emerald-500/30';
  if (confidence >= 70) return 'text-amber-400 bg-amber-950/50 border-amber-500/30';
  return 'text-rose-400 bg-rose-950/50 border-rose-500/30';
}

export function getSubjectColor(subject: string) {
  const sub = subject.toLowerCase();
  if (sub.includes('physics')) return 'text-sky-400 bg-sky-950/50 border-sky-500/30';
  if (sub.includes('chem')) return 'text-emerald-400 bg-emerald-950/50 border-emerald-500/30';
  if (sub.includes('bio')) return 'text-lime-400 bg-lime-950/50 border-lime-500/30';
  if (sub.includes('math')) return 'text-purple-400 bg-purple-950/50 border-purple-500/30';
  return 'text-indigo-400 bg-indigo-950/50 border-indigo-500/30';
}
