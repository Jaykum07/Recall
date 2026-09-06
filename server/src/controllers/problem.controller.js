import {
  createProblemService,
  getProblemService,
  getProblemsService,
  updateProblemService,
} from "../services/problem.service.js";

export const createProblemController = async (req, res, next) => {
  try {
    const problem = await createProblemService(req.body);
    res.status(201).json({
      success: true,
      message: "problem created",
      data: problem,
    });
  } catch (err) {
    next(err);
  }
};

export const getProblemsController = async (req, res, next) => {
  try {
    const data = await getProblemsService();
    res.status(200).json({
      success: true,
      message: "problems fetched",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getProblemController = async (req, res, next) => {
  try {
    const data = await getProblemService(req.params.id);
    res.status(200).json({
      success: true,
      message: "problem with id fetched",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const updateProblemController = async (req, res, next) => {
  try {
    const data = await updateProblemService(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: "update succesfully",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteProblemController = (req, res) => {
  res.status(200).json({
    success: true,
    message: "problem deleted",
  });
};
