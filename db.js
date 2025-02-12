const mongoose = require("mongoose");

const MONGO_DB_URI =
  process.env.NODE_ENV === "developement"
    ? "mongodb://localhost:27017/mynotes"
    : `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@taskapp.a6nkt.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
console.log(process.env.NODE_ENV)
async function createDbConnection() {
  try {
    await mongoose.connect(MONGO_DB_URI);
    console.log("Connecion established");
  } catch (error) {
    console.log(error.message);
  }
}

module.exports = {
  createDbConnection,
};
