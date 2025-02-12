
const mongoose = require('mongoose')


const Taskschema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required:true
    },
    category: {
        type: String,
        required: true
    }
}, { timestamps: true })


const Taskmodel = mongoose.model('tasks', Taskschema)

module.exports = Taskmodel
