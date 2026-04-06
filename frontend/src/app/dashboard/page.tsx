'use client';

// =============================================================================
// Dashboard Page (Phase 8: Stats Dashboard)
// =============================================================================
// Transformed into the user's Command Center for competitive coding.
// Displays EL0 rating Leaderboards and Due Spaced-Repetition Problems.
// =============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Trophy, Flame, Calendar, Code2, AlertTriangle, ArrowRight, BookOpen, Crown, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, loadProfile, initialize } = useAuthStore();

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [dueReviews, setDueReviews] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Generate 30 days mock activity data
  const [activityData] = useState(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      // Bias slightly towards level 0 or 1 for realistic look
      const rand = Math.random();
      const level = rand > 0.8 ? 4 : rand > 0.6 ? 3 : rand > 0.3 ? 2 : rand > 0.1 ? 1 : 0;
      return { id: i, date, level };
    });
  });

  const getActivityColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-indigo-900/40 border border-indigo-800/30';
      case 2: return 'bg-indigo-700/60 border border-indigo-600/40';
      case 3: return 'bg-indigo-500/80 border border-indigo-400';
      case 4: return 'bg-indigo-400 border border-indigo-300 shadow-[0_0_10px_rgba(129,140,248,0.4)]';
      default: return 'bg-[#0f0f0f] border border-gray-800/60';
    }
  };

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Redirect to login if not authenticated (after initialization)
  useEffect(() => {
    // Small delay to let initialize() run first
    const timer = setTimeout(() => {
      if (!useAuthStore.getState().isAuthenticated) {
        router.push('/login');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  // Load fresh profile data and stats on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadProfile();
      fetchDashboardStats();
    }
  }, [isAuthenticated, loadProfile]);

  const fetchDashboardStats = async () => {
    setIsLoadingStats(true);
    try {
      const [leaderboardRes, reviewsRes] = await Promise.all([
        api.get('/users/leaderboard?limit=10'),
        api.get('/reviews/due')
      ]);
      setLeaderboard(leaderboardRes.data.data);
      setDueReviews(reviewsRes.data.data);
    } catch (error) {
      console.error('Failed to load dashboard stats', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-[#0a0a0a] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
              <Code2 size={24} className="text-indigo-400" /> CodeForge
            </h1>
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold tracking-wider hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
              >
                KKB
              </button>

              <div 
                className={`absolute right-0 mt-3 w-64 bg-[#111111] border border-gray-800 rounded-xl shadow-2xl py-2 z-50 transition-all duration-200 origin-top-right ${
                  isDropdownOpen 
                    ? 'opacity-100 transform scale-100 translate-y-0 pointer-events-auto' 
                    : 'opacity-0 transform scale-95 -translate-y-2 pointer-events-none'
                }`}
              >
                <div className="px-4 py-3 border-b border-gray-800">
                  <p className="text-sm font-semibold text-white">Kshitish Kumar Behera</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{user.email || 'kshitishkumarbehera28@gmail.com'}</p>
                </div>
                
                <div className="py-2">
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    Settings
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    Editor Preferences
                  </button>
                </div>
                
                <div className="border-t border-gray-800 py-2">
                  <button
                    onClick={() => {
                      logout();
                      router.push('/login');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* KPI Stats Hero */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 hover:border-gray-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all duration-500 group-hover:bg-indigo-500/20 group-hover:scale-110" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                <Trophy className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-gray-400 font-medium">Global Rating</h3>
            </div>
            <p className="text-4xl font-bold text-white tracking-tight relative z-10">{user.rating} <span className="text-sm text-indigo-500 font-normal">EL0</span></p>
          </div>

          <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-500/10 hover:border-gray-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all duration-500 group-hover:bg-orange-500/20 group-hover:scale-110" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-gray-400 font-medium">Daily Streak</h3>
            </div>
            <p className="text-4xl font-bold text-white tracking-tight relative z-10">{user.streak} <span className="text-sm text-orange-500 font-normal">Days</span></p>
          </div>

          {/* Action Callout */}
          <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
            <h3 className="text-xl font-bold text-white mb-2">Ready to Grind?</h3>
            <p className="text-indigo-200 text-sm mb-4">Let our AI generate a personalized algorithmic challenge targeting your weak points.</p>
            <Link 
              href="/generate" 
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/25"
            >
              Generate Problem <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Activity Heatmap */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white mb-1">Recent Activity</h2>
            <span className="text-xs text-gray-500">Last 30 Days</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            {activityData.map((day) => (
              <div 
                key={day.id} 
                className={`w-4 h-4 rounded-[4px] shrink-0 transition-all duration-300 hover:scale-125 cursor-pointer ${getActivityColor(day.level)}`}
                title={`${day.date.toLocaleDateString()}: Level ${day.level}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 mt-3 text-xs text-gray-500">
            <span>Less</span>
            <div className={`w-3 h-3 rounded-sm ${getActivityColor(0)}`} />
            <div className={`w-3 h-3 rounded-sm ${getActivityColor(1)}`} />
            <div className={`w-3 h-3 rounded-sm ${getActivityColor(2)}`} />
            <div className={`w-3 h-3 rounded-sm ${getActivityColor(3)}`} />
            <div className={`w-3 h-3 rounded-sm ${getActivityColor(4)}`} />
            <span>More</span>
          </div>
        </div>

        {/* Dash Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Spaced Repetition Due (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen size={20} className="text-yellow-500" /> Due For Review
              </h2>
              <span className="text-sm text-gray-500">{dueReviews.length} Tasks Scheduled</span>
            </div>

            <div className={`bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden ${isLoadingStats || dueReviews.length > 0 ? 'min-h-[300px]' : ''}`}>
              {isLoadingStats ? (
                <div className="flex items-center justify-center h-full min-h-[300px]">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                </div>
              ) : dueReviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-8 py-12">
                  <div className="w-16 h-16 bg-gray-900/80 rounded-full flex items-center justify-center mb-5 border border-green-500/10 shadow-[0_0_15px_-3px_rgba(34,197,94,0.15)]">
                    <CheckCircle2 size={32} className="text-green-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">You're all caught up!</h3>
                  <p className="text-gray-400 text-sm max-w-sm mb-6 leading-relaxed">There are no spaced repetition problems due for review today. Enjoy your day off or generate a new challenge.</p>
                  
                  <Link 
                    href="/generate"
                    className="group flex items-center gap-2 px-5 py-2.5 bg-[#111] hover:bg-[#161616] border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-sm font-semibold rounded-xl transition-all duration-200"
                  >
                    <BookOpen size={16} className="text-indigo-400 group-hover:hidden" />
                    <span>Explore a new algorithm</span>
                    <ArrowRight size={16} className="hidden group-hover:block text-indigo-400" />
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-gray-800/60">
                  {dueReviews.map((review: any) => (
                    <li key={review.id} className="p-4 hover:bg-gray-900/50 transition-colors flex items-center justify-between group">
                      <div>
                        <Link href={`/problems/${review.problemId}`} className="text-indigo-300 font-bold hover:text-indigo-400 hover:underline inline-flex items-center gap-2 text-lg">
                          {review.problem.title} 
                        </Link>
                        <div className="flex gap-3 text-xs mt-2">
                          <span className="text-gray-500 font-mono uppercase bg-gray-900 px-2 py-0.5 rounded border border-gray-800">Topic: {review.problem.topic}</span>
                          <span className={`px-2 py-0.5 rounded border bg-black uppercase font-bold tracking-wide ${
                            review.problem.difficulty === 'EASY' ? 'text-green-500 border-green-500/20' : 
                            review.problem.difficulty === 'MEDIUM' ? 'text-yellow-500 border-yellow-500/20' : 
                            'text-red-500 border-red-500/20'
                          }`}>
                            {review.problem.difficulty}
                          </span>
                        </div>
                      </div>
                      <Link 
                        href={`/problems/${review.problemId}`}
                        className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-all"
                      >
                        Solve Now
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Global Leaderboards (Right column) */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Crown size={20} className="text-purple-500" /> Global Top 10
            </h2>

            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden min-h-[300px]">
              {isLoadingStats ? (
                <div className="flex items-center justify-center h-full min-h-[300px]">
                  <Loader2 className="animate-spin text-purple-500" size={32} />
                </div>
              ) : (
                <ul className="divide-y divide-gray-800/60">
                  {leaderboard.map((lbUser: any, index: number) => {
                    const isMe = lbUser.username === user.username;
                    return (
                      <li key={lbUser.username} className={`p-3 flex items-center gap-3 ${isMe ? 'bg-indigo-900/20' : ''}`}>
                        <div className={`w-6 h-6 rounded flex flex-shrink-0 items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 
                          index === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' : 
                          index === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-800/50' : 
                          'text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 truncate">
                          <p className={`text-sm font-medium truncate ${isMe ? 'text-indigo-300' : 'text-gray-300'}`}>
                            {lbUser.username}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-bold text-sm ${isMe ? 'text-indigo-400' : 'text-white'}`}>{lbUser.rating}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {leaderboard.length === 0 && !isLoadingStats && (
                <div className="p-8 text-center text-gray-500 text-sm">
                  Nobody has scored any points yet. Be the first!
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
