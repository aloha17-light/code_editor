import { Request, Response, NextFunction } from 'express';
import { processSubmission, evaluateSubmission } from './submission.service';

export async function submitCode(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const problemId = req.params.problemId;
    
    const result = await processSubmission(userId, problemId, req.body);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function evaluate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const submissionId = req.params.submissionId;
    
    const aiFeedback = await evaluateSubmission(submissionId, userId);
    
    res.status(200).json({
      success: true,
      data: aiFeedback,
    });
  } catch (error) {
    next(error);
  }
}

export async function traceCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { sourceCode } = req.body;
    
    // Using our Phase 5 tracer
    const trace = await (process.env.MOCK_TRACE === 'true') ? [] : await require('./submission.service').generateTrace(sourceCode);
    
    res.status(200).json({
      success: true,
      data: trace,
    });
  } catch (error) {
    next(error);
  }
}
