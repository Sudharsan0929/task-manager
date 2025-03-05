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
const bodyParser = require("body-parser");

const server = express();

//Middleware to parse cookies
server.use(cookieParser());

//DB Connectivity
createDbConnection();

//Body-parsing

// server.use(bodyParser.json());
server.use(express.json());
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
  res.render("pages/linkSent", { email: req.query.email || "" });
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
server.get("/createtask", authenticateToken, function (req, res) {
  res.render("pages/createTask");
});

// Note details page
server.get("/task/:taskId", authenticateToken, async function (req, res) {
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
  // console.log("Incoming signup request:", request.body);
  response.set("Cache-Control", "no-store");

  const { name, email, password } = request.body;
  try {
    const existingUser = await Usermodel.findOne({ email });
    // console.log("Existing user check:", existingUser);
    if (existingUser) {
      return response
        .status(400)
        .json({ success: false, error: "Email already exists" });
    }

    // Hashing password using argon2
    const hashedPassword = await argon2.hash(password);

    const newUser = new Usermodel({ name, email, password: hashedPassword });
    // console.log("Before saving user:", newUser);
    //Saving user to DB
    const result = await newUser.save();
    // console.log("User saved:", result);
    if (result && result._id) {
      if (request.headers["accept"]?.includes("application/json")) {
        return response.json({
          success: true,
          message: "Signup successful! Redirecting to signin...",
        });
      }
      return response.redirect(`${request.headers["origin"]}/signin`);
    }
  } catch (error) {
    if (request.headers["accept"]?.includes("application/json")) {
      console.error("Signup error:", error);
      response.status(500).json({ success: false, error: error.message });
    }
    response.render("pages/error", {
      error: error.message,
    });
  }
});

// Handle Login
server.post("/login", async (request, response) => {
  const { email, password } = request.body;

  try {
    // console.log("email:", email)
    const user = await Usermodel.findOne({ email });

    if (!user) {
      if (request.headers["accept"]?.includes("application/json")) {
        return response.status(400).json({ error: "User not found" });
      }
      return response.render("pages/error", { error: "User not found" });
    }

    // Verifying entered password with hashed password using argon2
    const isMatch = await argon2.verify(user.password, password);
    // console.log(isMatch)

    if (!isMatch) {
      if (request.headers["accept"]?.includes("application/json")) {
        return response.status(400).json({ error: "Invalid credentials" });
      }
      return response.render("pages/error", { error: "Invalid credentials" });
    }

    const token = await generateToken(user);
    // console.log(token)

    response.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600000, // 1 hour
    });

    if (request.headers["accept"]?.includes("application/json")) {
      return response.json({
        message: "Login successful",
        redirect: "/dashboard",
      });
    }

    return response.redirect("/dashboard");
  } catch (error) {
    if (request.headers["accept"]?.includes("application/json")) {
      return response
        .status(500)
        .json({ error: "Something went wrong. Please try again." });
    }
    response.render("pages/error", { error: error.message });
  }
});

// Handle forgotPassword
server.post("/checkemail", async (request, response) => {
  const { email } = request.body;
  try {
    const matchedUser = await Usermodel.findOne({ email });

    if (!matchedUser) {
      if (request.headers["accept"]?.includes("application/json")) {
        return response
          .status(400)
          .json({ success: false, error: "Email not found" });
      }
      return response.render("pages/error", { error: "Email not found" });
    }

    const resettoken = crypto.randomBytes(32).toString("hex");
    matchedUser.resettoken = resettoken;
    matchedUser.tokenexpiry = Date.now() + 3600000;
    await matchedUser.save();

    const resetUrl = `https://task-manager-zbth.onrender.com/createPassword?token=${resettoken}`;
    const subject = "Password reset link";
    const html = `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. The link expires in 1 hour.</p>`;
    await sendMail(email, subject, html);

    if (request.headers["accept"]?.includes("application/json")) {
      return response.json({
        success: true,
        message: "Reset link sent successfully!",
      });
    }

    return response.render("pages/linkSent", { email });
  } catch (error) {
    if (request.headers["accept"]?.includes("application/json")) {
      return response
        .status(500)
        .json({ success: false, error: error.message });
    }
    return response.render("pages/error", { error: error.message });
  }
});

// Handle Randomstring
server.post("/savepassword", TokenValidity, async (request, response) => {
  const { password, confirmpassword, token } = request.body;
  console.log("Received Token:", token);

  try {
    const matchedUser = await Usermodel.findOne({ resettoken: token });
    console.log("Matched User:", matchedUser);

    if (!matchedUser) {
      if (request.headers["accept"]?.includes("application/json")) {
        return response
          .status(400)
          .json({ success: false, error: "User not found" });
      }
      return response.render("pages/error", { error: "User not found" });
    }

    if (
      matchedUser.tokenexpiry &&
      new Date() > new Date(matchedUser.tokenexpiry)
    ) {
      if (request.headers["accept"]?.includes("application/json")) {
        return response
          .status(400)
          .json({ success: false, error: "Reset token has expired" });
      }
      return response.render("pages/error", {
        error: "Reset token has expired",
      });
    }

    if (password !== confirmpassword) {
      if (request.headers["accept"]?.includes("application/json")) {
        return response
          .status(400)
          .json({ success: false, error: "Passwords do not match" });
      }
      return response.render("pages/error", {
        error: "Passwords do not match",
      });
    }

    // Hash password and update user
    const hashedPassword = await argon2.hash(password);
    matchedUser.password = hashedPassword;
    matchedUser.resettoken = "";
    matchedUser.tokenexpiry = "";

    await matchedUser.save();

    if (request.headers["accept"]?.includes("application/json")) {
      return response.json({
        success: true,
        message: "Password updated successfully!",
      });
    }

    return response.redirect("/signin");
  } catch (error) {
    console.error("Error saving password:", error);
    if (request.headers["accept"]?.includes("application/json")) {
      return response
        .status(500)
        .json({ success: false, error: error.message });
    }
    return response.render("pages/error", { error: error.message });
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
