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

export const getProblemsService = async ({ difficulty, tags, platform }) => {
  try {
    const filter = {};
    if (difficulty !== undefined) {
      filter["problemInfo.difficulty"] = difficulty;
    }
    if (tags !== undefined) {
      const tagList = tags.split(",");
      filter["problemInfo.tags"] = {
        $in: tagList,
      };
    }
    if (platform !== undefined) {
      filter["problemInfo.platform"] = platform;
    }

    const problemsData = await Problem.find(filter);
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

    if (Object.keys(updatedData).length === 0) {
      const error = new Error("No data provided for update");
      error.statusCode = 400;

      throw error;
    }

    const problemData = await Problem.findByIdAndUpdate(
      id,
      { $set: updatedData },
      {
        new: true,
        runValidators: true,
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

export const deleteProblemService = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Bad Request");
      error.statusCode = 400;

      throw error;
    }

    const data = await Problem.findByIdAndDelete(id);

    if (!data) {
      const error = new Error("Problem not found.");
      error.statusCode = 404;

      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
};
