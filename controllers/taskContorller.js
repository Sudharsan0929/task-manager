const Taskmodel = require("../models/Taskmodel");



async function fetchAllTasks() {
    return Taskmodel.find()
}


async function fetchTaskWithId(taskId) {
    return Taskmodel.findOne({ _id: taskId })
}


module.exports = {
    fetchAllTasks,fetchTaskWithId
}