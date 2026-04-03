// =============================================================================
// Submission Service — Business Logic
// =============================================================================
// Orchestrates code execution by proxying payloads to Judge0 CE and parsing
// the raw responses back into Prisma domains (Verdict, Runtime, Memory).
// =============================================================================

import axios from 'axios';
import prisma from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { SubmitCodeInput } from './submission.schema';
import { Language, Verdict } from '@prisma/client';

const JUDGE0_URL = process.env.JUDGE0_API_URL || process.env.JUDGE0_URL || 'http://localhost:2358';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || ''; // If using managed RapidAPI
const JUDGE0_HOST = process.env.JUDGE0_HOST || 'judge0-ce.p.rapidapi.com';

// Maps our Prisma Language Enums to Judge0 CE internal Language IDs
function getJudge0LanguageId(lang: Language): number {
  switch (lang) {
    case 'C': return 50;
    case 'CPP': return 54;
    case 'JAVA': return 62;
    case 'PYTHON': return 71;
    default: throw new AppError('Unsupported Language', 400);
  }
}

// Maps Judge0 status IDs back to our Prisma Database Verdicts
function mapJudge0StatusToVerdict(statusId: number): Verdict {
  switch (statusId) {
    case 3: return 'ACCEPTED';
    case 4: return 'WRONG_ANSWER';
    case 5: return 'TIME_LIMIT_EXCEEDED';
    case 6: return 'COMPILATION_ERROR';
    case 7: 
    case 8: 
    case 9: 
    case 10:
    case 11:
    case 12: return 'RUNTIME_ERROR';
    default: return 'PENDING';
  }
}

export async function processSubmission(userId: string, problemId: string, data: SubmitCodeInput) {
  // 1. Fetch the Generated Problem (so we can get the AI-generated hidden test cases)
  const problem = await prisma.problemHistory.findUnique({
    where: { id: problemId },
  });

  if (!problem) {
    throw new AppError('Problem not found', 404);
  }

  // Define the test cases array structure
  const testCases = problem.testCases as Array<{ input: string; expectedOutput: string }>;
  if (!testCases || testCases.length === 0) {
    throw new AppError('Problem has no test cases to evaluate against.', 500);
  }

  // 2. Prepare the Batch Submission Payload for Judge0
  // Judge0 allows submitting multiple executions at once (Batch Submission).
  // We send one execution per test case.
  const languageId = getJudge0LanguageId(data.language);
  
  const submissions = testCases.map((tc) => ({
    language_id: languageId,
    source_code: data.sourceCode,
    stdin: tc.input || "",
    expected_output: tc.expectedOutput || "",
  }));

  try {
    // 3. Send to Judge0 using synchronous `wait=true` mode
    // (In production with heavy load, use async webhooks or polling)
    const requestConfig: any = {
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (JUDGE0_API_KEY) {
      requestConfig.headers['X-RapidAPI-Key'] = JUDGE0_API_KEY;
      requestConfig.headers['X-RapidAPI-Host'] = JUDGE0_HOST;
    }

    const response = await axios.post(`${JUDGE0_URL}/submissions/batch?wait=true`, {
      submissions
    }, requestConfig);

    const results = response.data; // Array of judge0 outputs
    
    // 4. Aggregate the results into a final verdict.
    // Logic: If EVERY test case passes, it's ACCEPTED. If ONE fails, we adopt that failure (e.g. WA or TLE).
    let finalVerdict: Verdict = 'ACCEPTED';
    let maxTime = 0;
    let maxMemory = 0;

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const statusId = res.status?.id || 0;
      const verdict = mapJudge0StatusToVerdict(statusId);
      
      // Track peak resource usage across all test cases
      if (res.time && parseFloat(res.time) > maxTime) maxTime = parseFloat(res.time);
      if (res.memory && res.memory > maxMemory) maxMemory = res.memory;

      // If we encounter any non-accepted state, override and break immediately.
      // E.g. A compilation error or wrong answer on test case 2.
      if (verdict !== 'ACCEPTED') {
        finalVerdict = verdict;
        break; // Stop evaluating further to save resources/time reporting
      }
    }

    // 5. Save the Submission to our database tracking history
    const savedSubmission = await prisma.submission.create({
      data: {
        userId,
        problemId,
        language: data.language,
        sourceCode: data.sourceCode,
        verdict: finalVerdict,
        runtime: maxTime,
        memory: maxMemory,
      }
    });

    // 5.5 Phase 7 gamification hook
    let gamificationInfo = undefined;
    if (finalVerdict === 'ACCEPTED') {
      const { awardPointsForSolve } = require('../users/user.service');
      const difficulty = (problem as any).difficulty || 'EASY'; // Fallback depending on Prisma model shape
      gamificationInfo = await awardPointsForSolve(userId, problemId, difficulty);
    }

    // 6. Return the detailed results so the UI can draw the console
    return {
      submissionId: savedSubmission.id,
      verdict: finalVerdict,
      runtime: maxTime,
      memory: maxMemory,
      gamification: gamificationInfo, // Sends +10 points UI back 
      details: results, // Full Judge0 batch output for the frontend console drawer
    };

  } catch (err: any) {
    console.error('Judge0 Error:', err.response?.data || err.message);
    throw new AppError('Code Execution Engine is unavailable.', 503);
  }
}

// Ensure the Python AI service URL is available (fallback to default docker compose port)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function evaluateSubmission(submissionId: string, userId: string) {
  // 1. Fetch submission with its associated problem
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { problem: true }
  });

  if (!submission) {
    throw new AppError('Submission not found', 404);
  }

  // 2. Ensure they own it
  if (submission.userId !== userId) {
    throw new AppError('Unauthorized access to this submission', 403);
  }

  // 3. Make the heavy-lifting call to our Layer 3 AI Service
  try {
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/evaluate`, {
      problemTitle: submission.problem.title,
      problemDescription: submission.problem.description,
      sourceCode: submission.sourceCode,
    });

    const aiData = aiResponse.data.data; // The CodeEvaluationOutput JSON from LangChain

    // 4. Persist the AI's grading back to PostgreSQL Layer 5
    const updatedSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        aiScore: aiData.score,
        aiFeedback: aiData,
      }
    });

    return updatedSubmission.aiFeedback;

  } catch (err: any) {
    console.error('AI Evaluator Error:', err.response?.data || err.message);
    throw new AppError('AI Evaluator is currently at capacity or unavailable.', 503);
  }
}
