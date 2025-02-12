const { name } = require('ejs')
const mongoose = require('mongoose')


const Userschema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    resettoken: {
        type: String,
    },
    tokenexpiry: {
      type: Date,
    },
  },
  { timestamps: true }
);


const Usermodel = mongoose.model('users', Userschema)

module.exports = Usermodel
