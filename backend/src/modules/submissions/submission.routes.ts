import { Router } from 'express';
import { submitCode, evaluate, traceCode } from './submission.controller';
import { validate } from '../../middleware/validate.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { submitCodeSchema } from './submission.schema';

const router = Router();

// POST /api/submissions/:problemId
// Runs the provided code against Judge0
router.post('/:problemId', authMiddleware, validate(submitCodeSchema), submitCode);

// POST /api/submissions/:submissionId/evaluate
// Calls LangChain to AI-review a specific past submission
router.post('/:submissionId/evaluate', authMiddleware, evaluate);

// POST /api/submissions/trace
// Executes user code via sys.settrace() and returns variable states
router.post('/trace', authMiddleware, traceCode);

export default router;
