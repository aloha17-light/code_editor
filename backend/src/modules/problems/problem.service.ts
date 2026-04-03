// =============================================================================
// Problem Service — Business Logic Layer
// =============================================================================
// Handles communication with the Python AI service and PostgreSQL database.
//
// Flow:
// 1. Fetch user's previously solved topics from ProblemHistory
// 2. Call AI Service (FastAPI) at POST /generate
// 3. Save the generated AI payload into PostgreSQL for auditing & future IDE use
// =============================================================================

import axios from 'axios';
import prisma from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { GenerateProblemInput } from './problem.schema';
import { Difficulty } from '@prisma/client';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function generateProblem(userId: string, data: GenerateProblemInput) {
  // 1. Fetch user's previous topics to prevent repeating exact problems
  const history = await prisma.problemHistory.findMany({
    where: { userId },
    select: { topic: true },
    orderBy: { createdAt: 'desc' },
    take: 10, // Just look at the last 10 problems
  });

  const previousTopics = history.map((h) => h.topic).filter(Boolean);

  // 2. Call the AI Python Microservice
  let aiResponseData: any;
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/generate`, {
      topic: data.topic,
      difficulty: data.difficulty,
      previous_topics: previousTopics,
    });
    // FASTAPI returns {"success": true, "data": { problem json }}
    aiResponseData = response.data.data ? response.data.data : response.data;
  } catch (error: any) {
    console.error('AI Service Error:', error.response?.data || error.message);
    const detail = error.response?.data?.detail || error.message || 'Unknown network error';
    throw new AppError(`Failed to generate problem. AI Engine says: ${detail}`, 502); 
  }

  // 3. Save into PostgreSQL
  // Map the structured JSON from the AI to the Prisma columns
  const problemRecord = await prisma.problemHistory.create({
    data: {
      userId,
      title: aiResponseData.title || 'Generated Problem',
      description: aiResponseData.description || '',
      difficulty: data.difficulty as Difficulty, // Ensure it's the Prisma enum
      topic: data.topic, // Storing the topic standardly
      examples: aiResponseData.examples || [],
      constraints: Array.isArray(aiResponseData.constraints) 
        ? aiResponseData.constraints.join('\n') 
        : (aiResponseData.constraints || ''),
      testCases: aiResponseData.testCases || [],
      aiPrompt: `Topic: ${data.topic}, Difficulty: ${data.difficulty}`,
      aiResponse: aiResponseData, // Full raw JSON response for audit trail
    },
  });

  return problemRecord;
}

export async function getProblemById(id: string, userId: string) {
  const problem = await prisma.problemHistory.findUnique({
    where: { id },
  });

  if (!problem) {
    const latest = await prisma.problemHistory.findFirst({ orderBy: { createdAt: 'desc' }});
    throw new AppError(`Problem not found. Searched ID: ${id}. Latest DB ID: ${latest?.id}`, 404);
  }

  // Ensure users only see their own generated problems for now, 
  // or remove this if problems should be public.
  if (problem.userId !== userId) {
    throw new AppError('Unauthorized access to this problem', 403);
  }

  return problem;
}
