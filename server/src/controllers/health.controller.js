const healthController = (req, res) => {
    res.status(200).json({
        success: true,
        message: "Recall API is running."
    });
}

export default healthController;