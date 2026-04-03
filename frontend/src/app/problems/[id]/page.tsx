'use client';

import { useEffect, useState, use } from 'react';
import { notFound } from 'next/navigation';
import api from '@/lib/api';
import EditorWorkspace from '@/components/editor/EditorWorkspace';

interface Example {
  input: string;
  expectedOutput: string;
  explanation: string;
}

interface Problem {
  id: string;
  title: string;
  description: string;
  topic: string;
  difficulty: string;
  examples: Example[];
  constraints: string;
}

export default function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchProblem() {
      try {
        const res = await api.get(`/problems/${resolvedParams.id}`);
        setProblem(res.data.data);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Problem not found.');
        } else {
          setError('Failed to load problem.');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchProblem();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
        <p className="text-gray-400 animate-pulse text-sm">Building IDE Workspace...</p>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col pt-32 items-center px-4">
        <h2 className="text-3xl font-bold text-white mb-4">Oops!</h2>
        <p className="text-gray-400">{error || 'Problem not found'}</p>
        <a href="/dashboard" className="mt-8 text-indigo-400 hover:text-indigo-300">
          Return to Dashboard
        </a>
      </div>
    );
  }

  const constraintsList = problem.constraints.split('\n').filter(Boolean);

  return (
    <div className="h-screen flex bg-gray-950 text-white font-sans overflow-hidden">
      
      {/* Left Pane: Problem Description (Static Width: 40%) */}
      <div className="w-2/5 h-full overflow-y-auto custom-scrollbar border-r border-gray-800 flex flex-col">
        <div className="p-8 pb-32">
          
          {/* Header Section */}
          <div className="mb-8 border-b border-gray-800 pb-6">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-black tracking-widest uppercase ${
                problem.difficulty === 'EASY' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                problem.difficulty === 'MEDIUM' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
              }`}>
                {problem.difficulty}
              </span>
              <span className="text-gray-400 text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 bg-gray-900 rounded border border-gray-800">
                {problem.topic}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">{problem.title}</h1>
          </div>

          {/* Content Section */}
          <div className="prose prose-invert max-w-none prose-pre:bg-gray-900/50 prose-pre:border prose-pre:border-gray-800 text-[15px]">
            
            {/* Description */}
            <div className="mb-10 text-gray-300 leading-relaxed whitespace-pre-wrap">
              {problem.description}
            </div>

            {/* Examples */}
            <h3 className="text-lg font-bold mb-4 text-white uppercase tracking-wide border-b border-gray-800 pb-2">Examples</h3>
            <div className="space-y-6 mb-10">
              {problem.examples.map((ex, idx) => (
                <div key={idx} className="bg-[#111] border border-gray-800/50 rounded-xl p-5 shadow-inner">
                  <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">Example {idx + 1}</p>
                  <div className="mb-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Input</span>
                    <code className="block bg-[#0a0a0a] p-3 rounded-lg border border-gray-800 font-mono text-sm text-indigo-300 whitespace-pre-wrap">
                      {ex.input}
                    </code>
                  </div>
                  <div className="mb-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Expected Output</span>
                    <code className="block bg-[#0a0a0a] p-3 rounded-lg border border-gray-800 font-mono text-sm text-green-400 whitespace-pre-wrap">
                      {ex.expectedOutput}
                    </code>
                  </div>
                  {ex.explanation && (
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Explanation</span>
                      <p className="text-sm text-gray-400 italic">
                        {ex.explanation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Constraints */}
            <h3 className="text-lg font-bold mb-4 text-white uppercase tracking-wide border-b border-gray-800 pb-2">Constraints</h3>
            <ul className="list-none space-y-2 mb-10 m-0 p-0">
              {constraintsList.map((constraint: string, idx: number) => (
                <li key={idx} className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                  <code className="bg-[#111] px-2 py-1 rounded border border-gray-800 text-sm text-gray-300 font-mono">
                    {constraint}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Right Pane: Monaco IDE Editor (Dynamic Width: 60%) */}
      <div className="w-3/5 h-full">
        <EditorWorkspace problemId={problem.id} />
      </div>

    </div>
  );
}
