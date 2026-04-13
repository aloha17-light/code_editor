'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Trophy, Flame, Code2, CheckCircle2, Clock,
  Cpu, ChevronDown, ChevronUp, Copy, Check, ExternalLink,
  Loader2, BookOpen, Zap, BarChart2
} from 'lucide-react';

interface Submission {
  id: string;
  language: string;
  sourceCode: string;
  runtime: number | null;
  memory: number | null;
  createdAt: string;
  problem: {
    id: string;
    title: string;
    topic: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  };
}

const difficultyStyles = {
  EASY:   { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  MEDIUM: { color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20' },
  HARD:   { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20'   },
};

const languageColors: Record<string, string> = {
  PYTHON: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  CPP: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  JAVA: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  C: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min ago`;
  return 'Just now';
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-[#0d0d0d] mt-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/60 border-b border-gray-800">
        <span className="text-xs font-mono text-gray-500">{language.toLowerCase()}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
        >
          {copied ? <><Check size={12} className="text-emerald-400" /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm font-mono text-gray-300 leading-relaxed max-h-64">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SubmissionCard({ submission, index }: { submission: Submission; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const diff = difficultyStyles[submission.problem.difficulty];
  const langClass = languageColors[submission.language] || 'text-gray-400 bg-gray-500/10 border-gray-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.045, type: 'spring', stiffness: 260, damping: 22 }}
      className="bg-[#0c0c10] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all group"
    >
      {/* Main Row */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Green tick */}
        <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 size={16} className="text-emerald-400" />
        </div>

        {/* Problem Title */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
            {submission.problem.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${diff.bg} ${diff.border} ${diff.color}`}>
              {submission.problem.difficulty}
            </span>
            <span className="text-[10px] font-mono uppercase text-gray-500 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded">
              {submission.problem.topic}
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${langClass}`}>
              {submission.language}
            </span>
          </div>
        </div>

        {/* Right side stats */}
        <div className="shrink-0 flex items-center gap-5 text-right">
          {submission.runtime !== null && (
            <div className="hidden sm:block">
              <p className="text-[11px] text-gray-600 uppercase font-medium">Runtime</p>
              <p className="text-sm font-bold text-white">{submission.runtime.toFixed(0)} ms</p>
            </div>
          )}
          <div>
            <p className="text-[11px] text-gray-600 uppercase font-medium">When</p>
            <p className="text-sm font-semibold text-gray-300 flex items-center gap-1">
              <Clock size={11} className="text-gray-600" />{timeAgo(submission.createdAt)}
            </p>
          </div>
          <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {/* Expanded Code View */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="code"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-5 pb-5 border-t border-gray-800/60 overflow-hidden"
          >
            <div className="flex items-center justify-between mt-3 mb-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Accepted Solution</p>
              <Link
                href={`/problems/${submission.problem.id}`}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={12} /> Reopen Problem
              </Link>
            </div>
            <CodeBlock code={submission.sourceCode} language={submission.language} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, initialize, logout } = useAuthStore();
  const [history, setHistory] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'EASY' | 'MEDIUM' | 'HARD'>('ALL');
  const [langFilter, setLangFilter] = useState<string>('ALL');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initialize();
    setInitialized(true);
  }, [initialize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!useAuthStore.getState().isAuthenticated) router.push('/login');
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (!initialized) return;
    // Read token directly from localStorage — avoids React state timing issues
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    setFetchError(null);
    api.get('/submissions/history')
      .then(res => {
        const data = res.data.data;
        setHistory(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        const msg = err.response?.data?.message || err.message || 'Failed to load history';
        setFetchError(msg);
        console.error('History fetch error:', err);
      })
      .finally(() => setIsLoading(false));
  }, [initialized]);

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="animate-spin text-indigo-500" size={36} />
      </div>
    );
  }

  const languages = ['ALL', ...Array.from(new Set(history.map(s => s.language)))];
  const filtered = history.filter(s => {
    const diffOk = filter === 'ALL' || s.problem.difficulty === filter;
    const langOk = langFilter === 'ALL' || s.language === langFilter;
    return diffOk && langOk;
  });

  const stats = {
    total: history.length,
    easy: history.filter(s => s.problem.difficulty === 'EASY').length,
    medium: history.filter(s => s.problem.difficulty === 'MEDIUM').length,
    hard: history.filter(s => s.problem.difficulty === 'HARD').length,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-300">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="font-semibold">Dashboard</span>
          </Link>
          <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
            <Code2 size={20} className="text-indigo-400" /> CodeForge
          </h1>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* Profile Hero */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-indigo-500/25">
            {user.username?.slice(0, 2).toUpperCase() || 'ME'}
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">{user.username}</h2>
            <p className="text-gray-500 text-sm mt-1">{user.email}</p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm font-bold text-indigo-300">
                <Trophy size={14} className="text-indigo-400" /> {user.rating} EL0
              </span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-orange-300">
                <Flame size={14} className="text-orange-400" /> {user.streak} Day Streak
              </span>
              {(user as any).maxStreak > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-bold text-yellow-300">
                  <Trophy size={14} className="text-yellow-400" /> Best: {(user as any).maxStreak} Days
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Solved', value: stats.total, icon: <Zap size={16} className="text-indigo-400" />, color: 'text-indigo-300' },
            { label: 'Easy', value: stats.easy,   icon: <BarChart2 size={16} className="text-emerald-400" />, color: 'text-emerald-300' },
            { label: 'Medium', value: stats.medium, icon: <BarChart2 size={16} className="text-yellow-400" />,  color: 'text-yellow-300' },
            { label: 'Hard', value: stats.hard,   icon: <BarChart2 size={16} className="text-red-400" />,     color: 'text-red-300' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gray-900 border border-gray-800">{icon}</div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* History Section */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen size={20} className="text-indigo-400" /> Accepted Submissions
            </h3>
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {(['ALL', 'EASY', 'MEDIUM', 'HARD'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setFilter(d)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    filter === d
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
              <div className="w-px h-5 bg-gray-800" />
              {languages.map(lang => (
                <button
                  key={lang}
                  onClick={() => setLangFilter(lang)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    langFilter === lang
                      ? 'bg-purple-700 border-purple-500 text-white'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="animate-spin text-indigo-500" size={36} />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center text-center py-16 border-2 border-dashed border-red-800/40 rounded-2xl">
              <p className="text-red-400 font-bold mb-2">Failed to load history</p>
              <p className="text-xs text-red-500/80 font-mono bg-red-900/10 px-4 py-2 rounded-lg mb-4 max-w-md break-all">{fetchError}</p>
              <button
                onClick={() => { setIsLoading(true); setFetchError(null); api.get('/submissions/history').then(res => setHistory(Array.isArray(res.data.data) ? res.data.data : [])).catch(e => setFetchError(e.message)).finally(() => setIsLoading(false)); }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-all"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-24 border-2 border-dashed border-gray-800 rounded-2xl">
              <Cpu size={52} className="text-gray-700 mb-4" />
              <h4 className="text-lg font-bold text-white mb-1">No accepted solutions yet</h4>
              <p className="text-gray-500 text-sm max-w-xs mb-6">Your solved problems will appear here once you pass all test cases.</p>
              <Link href="/generate" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                Generate a Problem
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((submission, i) => (
                <SubmissionCard key={submission.id} submission={submission} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
