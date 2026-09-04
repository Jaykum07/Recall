import Problem from "../models/problem.model.js";

const createProblemService = async (problemData) => {
  const problem = await Problem.create({
    ...problemData,
    userLearningInfo: {
      ...problemData.userLearningInfo,
      confidence: 3,
    },
  });

  return problem;
};

export default createProblemService;
