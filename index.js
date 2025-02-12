const dotenv = require("dotenv");
dotenv.config();
const cookieParser = require("cookie-parser");
const express = require("express");
const argon2 = require("argon2");
const { createDbConnection } = require("./db");
const Usermodel = require("./models/Usermodel");
const Taskmodel = require("./models/Taskmodel");
const crypto = require("crypto");
const {
  fetchAllTasks,
  fetchTaskWithId,
} = require("./controllers/taskContorller");
const { generateToken } = require("./utils/jwt");
const sendMail = require("./utils/email.utils");
const authenticateToken = require("./middlewares/jwtguard");
const TokenValidity = require("./middlewares/Tokenvalidity");

const server = express();

//Middleware to parse cookies
server.use(cookieParser()); 

//DB Connectivity
createDbConnection();

//Body-parsing
server.use(express.urlencoded({ extended: true }));

// set the view engine to ejs
server.set("view engine", "ejs");

//configure static folder
server.use(express.static("public"));

// index page
server.get("/signin", function (req, res) {
  res.render("pages/index");
});

// about page
server.get("/", function (req, res) {
  res.render("pages/signup");
});

// Confirm email page
server.get("/forgotpassword", function (req, res) {
  res.render("pages/forgotPassword");
});


// Confirm linksent page
server.get("/linksent", function (req, res) {
  res.render("pages/linkSent");
});


// Create password page
server.get("/createPassword", (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.render("pages/error", { error: "Invalid or missing token" });
  }

  res.render("pages/createPassword", { token }); // Pass token to EJS
});


// Dashboard page
server.get("/dashboard", async function (req, res) {
  const tasks = await fetchAllTasks();
  // console.log(tasks);
  res.render("pages/dashboard", {
    data: tasks,
  });
});



// Create Notes page
server.get("/createtask",authenticateToken, function (req, res) {
  res.render("pages/createTask");
});

// Note details page
server.get("/task/:taskId",authenticateToken, async function (req, res) {
  const { taskId } = req.params;

  try {
    const task = await fetchTaskWithId(taskId);
    res.render("pages/taskDetails", {
      task,
    });
  } catch (error) {
    res.render("pages/error", {
      error: error.message,
    });
  }
});



// Error page
server.get("/error", function (req, res) {
  res.render("pages/error", {
    error: "Something went wrong",
  });
});



// Handle Signup
server.post("/signup", async (request, response) => {
  const { name, email, password } = request.body;
  try {
    // Hashing password using argon2
    const hashedPassword = await argon2.hash(password);

    const newUser = new Usermodel({ name, email, password: hashedPassword });

    //Saving user to DB
    const result = await newUser.save();
    // console.log(result);
    if (result && result._id) {
      return response.redirect(`${request.headers["origin"]}/signin`);
    }
  } catch (error) {
    response.render("pages/error", {
      error: error.message,
    });
  }
});



// Handle Login
server.post("/login", async (request, response) => {
  const { email, password } = request.body;
  try {
    const user = await Usermodel.findOne({ email });

    if (!user) {
      return response.render("pages/error", { error: "User not found" });
    }

    // Verifying entered password with hashed password using argon2
    const isMatch = await argon2.verify(user.password, password);

    if (!isMatch) {
      return response.render("pages/error", {
        error: "Invalid credentials",
      });
    }

    const token = await generateToken(user);
    // console.log(token);

    response.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: "3600000",
    });

    return response.redirect(`${request.headers["origin"]}/dashboard`);
  } catch (error) {
    response.render("pages/error", {
      error: error.message,
    });
  }
});



// Handle forgotPassword
server.post("/checkemail", async (request, response) => {
  const { email } = request.body;
  try {
    const matchedUser = await Usermodel.findOne({ email });
    if (!matchedUser) {
      response.render("pages/error", {
        error: "Email not found",
      });
    }

    const resettoken = crypto.randomBytes(32).toString("hex");
    // console.log(`token:${resettoken}`);
    matchedUser.resettoken = resettoken;
    matchedUser.tokenexpiry = Date.now() + 3600000;
    await matchedUser.save();

    const resetUrl = `https://task-manager-zbth.onrender.com/createPassword?token=${resettoken}`; //CREATING RESET LINK PASSING RESET TOKEN AS QUERY
    const subject = "Password reset link";
    const html = `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. The link expires in 1 hour.</p>`;
    await sendMail(email, subject, html);
    // console.log(resetUrl);

    return response.render("pages/linkSent", { email });
  } catch (error) {
    response.render("pages/error", {
      error: error.message,
    });
  }
});




// Handle Randomstring
server.post("/savepassword", TokenValidity, async (request, response) => {
  const { password, confirmpassword } = request.body;
  const { token } = request.body || request.query
  console.log(token);

  try {
    const matchedUser = await Usermodel.findOne({ resettoken: token });
    console.log(matchedUser)

    if (!matchedUser) {
      return response.render("pages/error", {
        error: "User not found",
      });
    }

    if ( matchedUser.tokenexpiry && new Date() > new Date(matchedUser.tokenexpiry) ) {
      return response.render("pages/error", {
        error: "Reset token has expired. Please request a new one.",
      });
    }

    if (password !== confirmpassword) {
      response.render("pages/error", {
        error: "Password and confirm password must be same",
      });
    }

    const hashedPassword = await argon2.hash(password);
    matchedUser.password = hashedPassword;
    matchedUser.resettoken = "";
    matchedUser.tokenexpiry = "";

    await matchedUser.save();

    return response.redirect(`${request.headers["origin"]}/signin`);
  } catch (error) {
    response.render("pages/error", {
      error: error.message,
    });
  }
});



// Handle Save Notes
server.post("/savetask", async (request, response) => {
  const { name, description } = request.body;
  try {
    const newTask = new Taskmodel(request.body);
    const result = await newTask.save();
    if (result && result._id) {
      return response.redirect(`${request.headers["origin"]}/dashboard`);
    }
  } catch (error) {
    response.render("pages/error", {
      error: error.message,
    });
  }
});


//STARTING THE SERVER
server.listen(process.env.PORT, process.env.HOST, () => {
  console.log("Server started");
});
