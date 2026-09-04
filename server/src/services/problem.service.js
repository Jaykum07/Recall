const createProblemService = (problemData) => {
    return {
        id: 1,
        ...problemData,
        confidence: 3
    };
}

export default createProblemService;    