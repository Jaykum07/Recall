export const createProblemController =(req, res) => {
    res.status(201).json({
        success: true,
        message: "problem created"
    });
}

export const getProblemsController = (req, res) => {
    res.status(200).json({
        success: true,
        message: "problems fetched"
    });
}

export const getProblemController= (req, res) => {
    res.status(200).json({
        success: true,
        message: "problem with id fetched"
    });
}

export const updateProblemController= (req, res) => {
    res.status(200).json({
        success: true,
        message: "update succesfully"
    });
}

export const deleteProblemController= (req, res) => {
    res.status(200).json({
        success: true,
        message: "problem deleted"
    });
}