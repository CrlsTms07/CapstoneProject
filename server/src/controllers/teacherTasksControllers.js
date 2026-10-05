const {
    getAllTeacherTasks,
    getTeacherTaskById,
    createTeacherTask,
    updateTeacherTask,
    deleteTeacherTask
} = require("../models/teacherTasksModel");

// GET all teacher tasks
const getTeacherTasks = async (req, res) => {
    try {
        const tasks = await getAllTeacherTasks();

        res.status(200).json(tasks);
    } catch (error) {
        console.error("Error fetching teacher tasks:", error);

        res.status(500).json({
            error: "Failed to fetch teacher tasks",
            details: error.message
        });
    }
};

// GET teacher task by ID
const getTeacherTask = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await getTeacherTaskById(id);

        if (!task) {
            return res.status(404).json({
                error: "Teacher task not found"
            });
        }

        res.status(200).json(task);
    } catch (error) {
        console.error("Error fetching teacher task:", error);

        res.status(500).json({
            error: "Failed to fetch teacher task",
            details: error.message
        });
    }
};

// CREATE teacher task
const createTeacherTaskRecord = async (req, res) => {
    try {
        const { teacher_id } = req.body;

        const task = await createTeacherTask(teacher_id);

        res.status(201).json(task);
    } catch (error) {
        console.error("Error creating teacher task:", error);

        if (error.code === "23503") {
            return res.status(400).json({
                error: "Invalid foreign key",
                message: "The teacher referenced by this task does not exist.",
                details: error.detail
            });
        }

        if (error.code === "23502") {
            return res.status(400).json({
                error: "Missing required field",
                message: "A required teacher task field was not provided.",
                details: error.detail
            });
        }

        return res.status(500).json({
            error: "Failed to create teacher task",
            details: error.message
        });
    }
};

// UPDATE teacher task
const updateTeacherTaskRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { teacher_id } = req.body;

        const task = await updateTeacherTask(id, teacher_id);

        if (!task) {
            return res.status(404).json({
                error: "Teacher task not found"
            });
        }

        res.status(200).json(task);
    } catch (error) {
        console.error("Error updating teacher task:", error);

        res.status(500).json({
            error: "Failed to update teacher task",
            details: error.message
        });
    }
};

// DELETE teacher task
const deleteTeacherTaskRecord = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await deleteTeacherTask(id);

        if (!task) {
            return res.status(404).json({
                error: "Teacher task not found"
            });
        }

        res.status(200).json({
            message: "Teacher task deleted successfully",
            task
        });
    } catch (error) {
        console.error("Error deleting teacher task:", error);

        res.status(500).json({
            error: "Failed to delete teacher task",
            details: error.message
        });
    }
};

module.exports = {
    getTeacherTasks,
    getTeacherTask,
    createTeacherTaskRecord,
    updateTeacherTaskRecord,
    deleteTeacherTaskRecord
};