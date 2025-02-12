const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const token =
        req.cookies.auth_token || req.headers.authorization?.split(" ")[1];
    console.log(token)

    if (!token) {
      res.clearCookie("auth_token"); // Remove expired token
      return res
        .status(401)
        .render("pages/tokenError", { error: "Access denied. Redirecting to Signin page....." });
    }

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    if (err) {
      res.clearCookie("auth_token"); // Remove expired token
      return res.redirect("/signin"); // Redirect to login
    }
    req.user = user;
    next();
  });

}

module.exports = authenticateToken;
