import mongoose from "mongoose";
import Problem from "../models/problem.model.js";

export const createProblemService = async (problemData, userId) => {
  try {
    const problem = await Problem.create({
      // Accept problem content only; ownership always comes from authentication.
      problemInfo: problemData.problemInfo,
      userId,
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

export const getProblemsService = async ({
  difficulty,
  tags,
  platform,
  search,
  page = 1,
  limit = 10,
  sortBy,
  order,
}, userId) => {
  try {
    const pipeline = [];

    // Mongoose does not cast aggregation pipeline values to ObjectIds.
    const filter = { userId: new mongoose.Types.ObjectId(userId) };
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

    if (search !== undefined && search.trim() !== "") {
      filter["problemInfo.problemName"] = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    pipeline.push({ $match: filter });

    const skip = (page - 1) * limit;
    const sortOrder = order === "desc" ? -1 : 1;

    if (sortBy === "difficulty") {
      const customSorting = {
        difficultyRank: {
          $indexOfArray: [
            ["easy", "medium", "hard"],
            "$problemInfo.difficulty",
          ],
        },
      };
      pipeline.push({
        $addFields: customSorting,
      });
      pipeline.push({ $sort: { difficultyRank: sortOrder } });
    } else if (sortBy !== undefined) {
      const sortOptions = {};
      sortOptions[`userLearningInfo.${sortBy}`] = sortOrder;
      pipeline.push({ $sort: sortOptions });
    }

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    if (sortBy === "difficulty") {
      pipeline.push({
        $project: {
          difficultyRank: 0,
        },
      });
    }

    const [problems, totalProblems] = await Promise.all([
      Problem.aggregate(pipeline),
      Problem.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalProblems / limit);

    return {
      problems,
      pagination: {
        page,
        limit,
        totalProblems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  } catch (err) {
    throw err;
  }
};

export const getProblemService = async (id, userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Bad Request");
      error.statusCode = 400;

      throw error;
    }

    const problemData = await Problem.findOne({ _id: id, userId });

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

export const updateProblemService = async (id, data, userId) => {
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

    const problemData = await Problem.findOneAndUpdate(
      { _id: id, userId },
      { $set: updatedData },
      {
        returnDocument: "after",
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

export const deleteProblemService = async (id, userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Bad Request");
      error.statusCode = 400;

      throw error;
    }

    const data = await Problem.findOneAndDelete({ _id: id, userId });

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
