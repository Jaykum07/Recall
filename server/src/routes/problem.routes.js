import express from "express";
import {
  createProblemController,
  deleteProblemController,
  getProblemController,
  getProblemsController,
  updateProblemController,
} from "../controllers/problem.controller.js";
import {
  validateUpdateProblem,
  validateProblemFilters,
} from "../validators/problem.validator.js";

const router = express.Router();

router.post("/", createProblemController);
router.get("/", validateProblemFilters, getProblemsController);
router.get("/:id", getProblemController);
router.patch("/:id", validateUpdateProblem, updateProblemController);
router.delete("/:id", deleteProblemController);

export default router;
