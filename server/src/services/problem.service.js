import mongoose from "mongoose";
import Problem from "../models/problem.model.js";

export const createProblemService = async (problemData) => {
  try {
    const problem = await Problem.create({
      ...problemData,
      userLearningInfo: {
        ...problemData.userLearningInfo,
        confidence: 3,
      },
    });

    return problem;
  } catch (err) {
    console.log("Problem creation failed");
    throw err;
  }
};

export const getProblemsService = async () => {
  try {
    const problemsData = await Problem.find();
    return problemsData;
  } catch (err) {
    throw err;
  }
};

export const getProblemService = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Bad Request");
      error.statusCode = 400;

      throw error;
    }

    const problemData = await Problem.findById(id);

    if (!problemData) {
      const error = new Error("Problem not Found");
      error.statusCode = 404;

      throw error;
    }

    return problemData;
  } catch (err) {
    throw err;
  }
};

export const updateProblemService = async (id, data) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Bad Request");
      error.statusCode = 400;

      throw error;
    }

    const updatedData = {};
    if (data.userLearningInfo?.confidence !== undefined) {
      updatedData["userLearningInfo.confidence"] =
        data.userLearningInfo.confidence;
    }

    const problemData = await Problem.findByIdAndUpdate(
      id,
      { $set: updatedData },
      {
        new: true,
      }
    );

    if (!problemData) {
      const error = new Error("Problem not Found");
      error.statusCode = 404;

      throw error;
    }

    return problemData;
  } catch (err) {
    throw err;
  }
};
