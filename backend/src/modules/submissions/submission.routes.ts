import { Router } from 'express';
import { submitCode, evaluate, traceCode, getHistory } from './submission.controller';
import { validate } from '../../middleware/validate.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { submitCodeSchema } from './submission.schema';

const router = Router();

// POST /api/submissions/trace
// Executes user code via sys.settrace() and returns variable states
// MUST be placed above /:problemId so "trace" isn't misidentified as a problem ID.
router.post('/trace', authMiddleware, traceCode);

// GET /api/submissions/history
// Returns all ACCEPTED submissions for the current user (their solve history)
router.get('/history', authMiddleware, getHistory);

// POST /api/submissions/:problemId
// Runs the provided code against Judge0
router.post('/:problemId', authMiddleware, validate(submitCodeSchema), submitCode);

// POST /api/submissions/:submissionId/evaluate
// Calls LangChain to AI-review a specific past submission
router.post('/:submissionId/evaluate', authMiddleware, evaluate);

export default router;
