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

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

async function executeLocally(language: Language, sourceCode: string, input: string) {
  const runId = uuidv4();
  // Ensure the app has a tmp directory, Docker alpine has /tmp
  const tmpDir = path.join('/tmp', runId);
  fs.mkdirSync(tmpDir, { recursive: true });

  let stdout = '';
  let stderr = '';
  let compileOutput = '';
  let code = 0;
  let signal = '';

  try {
    const inputPath = path.join(tmpDir, 'input.txt');
    fs.writeFileSync(inputPath, input);

    if (language === 'PYTHON') {
      const scriptPath = path.join(tmpDir, 'main.py');
      fs.writeFileSync(scriptPath, sourceCode);
      
      try {
        const result = await execAsync(`python3 ${scriptPath} < ${inputPath}`, { timeout: 3000 });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        stdout = err.stdout || '';
        stderr = err.stderr || err.message || '';
        code = err.code || 1;
        if (err.killed) signal = 'SIGTERM';
      }
    } else if (language === 'CPP' || language === 'C') {
      const ext = language === 'CPP' ? 'cpp' : 'c';
      const compiler = language === 'CPP' ? 'g++' : 'gcc';
      const scriptPath = path.join(tmpDir, `main.${ext}`);
      const outPath = path.join(tmpDir, 'a.out');
      fs.writeFileSync(scriptPath, sourceCode);

      try {
        await execAsync(`${compiler} ${scriptPath} -o ${outPath}`);
      } catch (err: any) {
        compileOutput = err.stderr || err.message;
        code = 1;
        return { stdout, stderr, code, compileOutput, signal };
      }

      try {
        const result = await execAsync(`${outPath} < ${inputPath}`, { timeout: 3000 });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        stdout = err.stdout || '';
        stderr = err.stderr || err.message || '';
        code = err.code || 1;
        if (err.killed) signal = 'SIGTERM';
      }
    } else if (language === 'JAVA') {
      const scriptPath = path.join(tmpDir, 'Solution.java');
      fs.writeFileSync(scriptPath, sourceCode);

      try {
        await execAsync(`javac ${scriptPath}`);
      } catch (err: any) {
        compileOutput = err.stderr || err.message;
        code = 1;
        return { stdout, stderr, code, compileOutput, signal };
      }

      try {
        const result = await execAsync(`java -cp ${tmpDir} Solution < ${inputPath}`, { timeout: 3000 });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        stdout = err.stdout || '';
        stderr = err.stderr || err.message || '';
        code = err.code || 1;
        if (err.killed) signal = 'SIGTERM';
      }
    } else {
      throw new Error("Unsupported local execution language");
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return { stdout, stderr, code, compileOutput, signal };
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

  try {
    // 2. Execute all test cases consecutively or concurrently natively!
    // We'll execute concurrently to save time
    const executionPromises = testCases.map(async (tc) => {
      const runResult = await executeLocally(data.language, data.sourceCode, tc.input || '');
      return { result: runResult, tc };
    });

    const executionResults = await Promise.all(executionPromises);

    // 3. Aggregate the results into a final verdict.
    let finalVerdict: Verdict = 'ACCEPTED';
    let maxTime = 0; // Local exec doesn't easily expose high precision cpu time without wrapper
    let maxMemory = 0;

    const uiDetails = [];

    for (const execution of executionResults) {
      const res = execution.result;
      const tc = execution.tc;

      let statusId = 3; // Default to Accepted
      let description = 'ACCEPTED';
      let compileOutput = res.compileOutput;
      
      // Ensure we treat `null` expected outputs gracefully, UI expects strings
      let stdout = res.stdout || '';
      let stderr = res.stderr || '';

      if (compileOutput) {
        statusId = 6;
        description = 'COMPILATION ERROR';
        finalVerdict = 'COMPILATION_ERROR';
      } else if (res.code !== 0) {
        statusId = 11;
        description = res.signal ? `TIME LIMIT EXCEEDED (${res.signal})` : 'RUNTIME ERROR';
        finalVerdict = res.signal ? 'TIME_LIMIT_EXCEEDED' : 'RUNTIME_ERROR';
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
        time: '0.05', 
        memory: 0
      });

      if (finalVerdict !== 'ACCEPTED') {
        break; // Stop evaluating further to save UI clutter
      }
    }

    // 4. Save the Submission to our database tracking history
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

    // 4.5 Phase 7 gamification hook
    let gamificationInfo = undefined;
    if (finalVerdict === 'ACCEPTED') {
      const { awardPointsForSolve } = require('../users/user.service');
      const difficulty = (problem as any).difficulty || 'EASY';
      gamificationInfo = await awardPointsForSolve(userId, problemId, difficulty);
    }

    // 5. Return the detailed results identically mapped so the UI doesn't break
    return {
      submissionId: savedSubmission.id,
      verdict: finalVerdict,
      runtime: maxTime,
      memory: maxMemory,
      gamification: gamificationInfo, 
      details: uiDetails, 
    };

  } catch (err: any) {
    console.error('Local Execution Error:', err.message);
    throw new AppError(`Code Execution Engine failed: ${err.message}`, 503);
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
    const detail = err.response?.data?.detail || err.message || 'Unknown error';
    throw new AppError(`AI Evaluator failed. Engine says: ${detail}`, 503);
  }
}
