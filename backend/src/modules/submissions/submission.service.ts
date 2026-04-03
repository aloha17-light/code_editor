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

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

// Maps our Prisma Language Enums to Piston Language strings
function getPistonLanguage(lang: Language): { language: string, version: string } {
  switch (lang) {
    case 'C': return { language: 'c', version: '10.2.0' };
    case 'CPP': return { language: 'cpp', version: '10.2.0' };
    case 'JAVA': return { language: 'java', version: '15.0.2' };
    case 'PYTHON': return { language: 'python', version: '3.10.0' };
    default: throw new AppError('Unsupported Language', 400);
  }
}

export async function processSubmission(userId: string, problemId: string, data: SubmitCodeInput) {
  // 1. Fetch the Generated Problem
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

  // 2. Prepare for Piston Execution
  const pistonLang = getPistonLanguage(data.language);

  try {
    // 3. Execute all test cases concurrently via Piston
    const executionPromises = testCases.map(async (tc) => {
      const response = await axios.post(PISTON_URL, {
        language: pistonLang.language,
        version: pistonLang.version,
        files: [{ content: data.sourceCode }],
        stdin: tc.input || ""
      });
      return { 
        result: response.data, 
        tc 
      };
    });

    const executionResults = await Promise.all(executionPromises);

    // 4. Aggregate the results into a final verdict.
    let finalVerdict: Verdict = 'ACCEPTED';
    let maxTime = 0;
    let maxMemory = 0;

    const uiDetails = [];

    for (const execution of executionResults) {
      const runData = execution.result.run;
      const compileData = execution.result.compile;
      const tc = execution.tc;

      let statusId = 3; // Default to Accepted
      let description = 'ACCEPTED';
      let compileOutput = compileData ? compileData.output : '';
      let stdout = runData && runData.stdout ? runData.stdout : '';
      let stderr = runData && runData.stderr ? runData.stderr : '';

      if (compileData && compileData.code !== 0) {
        statusId = 6;
        description = 'COMPILATION ERROR';
        finalVerdict = 'COMPILATION_ERROR';
      } else if (runData && runData.code !== 0) {
        statusId = 11;
        description = runData.signal ? `TIME LIMIT EXCEEDED (${runData.signal})` : 'RUNTIME ERROR';
        finalVerdict = runData.signal ? 'TIME_LIMIT_EXCEEDED' : 'RUNTIME_ERROR';
      } else {
        // Compare stdout with expectedOutput
        if (stdout.trim() !== tc.expectedOutput.trim()) {
           statusId = 4;
           description = 'WRONG ANSWER';
           finalVerdict = 'WRONG_ANSWER';
        }
      }

      uiDetails.push({
        status: { id: statusId, description: description },
        compile_output: compileOutput,
        stdout: stdout,
        stderr: stderr,
        time: '0.05', // Piston v2 doesn't expose strict runtime metadata by default
        memory: 0
      });

      if (finalVerdict !== 'ACCEPTED') {
        break; // Stop evaluating further to save UI clutter
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
      const difficulty = (problem as any).difficulty || 'EASY';
      gamificationInfo = await awardPointsForSolve(userId, problemId, difficulty);
    }

    // 6. Return the detailed results identically mapped so the UI doesn't break
    return {
      submissionId: savedSubmission.id,
      verdict: finalVerdict,
      runtime: maxTime,
      memory: maxMemory,
      gamification: gamificationInfo, 
      details: uiDetails, 
    };

  } catch (err: any) {
    console.error('Piston Execution Error:', err.response?.data || err.message);
    const detail = err.response?.data?.message || err.message || 'Unknown network error';
    throw new AppError(`Code Execution Engine is unavailable: ${detail}`, 503);
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
