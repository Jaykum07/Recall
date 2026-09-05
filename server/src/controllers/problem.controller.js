import createProblemService from "../services/problem.service.js";

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

export const getProblemsController = (req, res) => {
  res.status(200).json({
    success: true,
    message: "problems fetched",
  });
};

export const getProblemController = (req, res) => {
  res.status(200).json({
    success: true,
    message: "problem with id fetched",
  });
};

export const updateProblemController = (req, res) => {
  res.status(200).json({
    success: true,
    message: "update succesfully",
  });
};

export const deleteProblemController = (req, res) => {
  res.status(200).json({
    success: true,
    message: "problem deleted",
  });
};
