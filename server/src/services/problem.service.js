import Problem from "../models/problem.model.js";

const createProblemService = async (problemData) => {
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

export default createProblemService;
