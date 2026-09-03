import express from 'express';
import { createProblemController, deleteProblemController, getProblemController, getProblemsController, updateProblemController } from '../controllers/problem.controller.js';

const router = express.Router();

router.post('/', createProblemController);
router.get('/', getProblemsController);
router.get('/:id', getProblemController);
router.patch('/:id', updateProblemController);
router.delete('/:id', deleteProblemController);

export default router;