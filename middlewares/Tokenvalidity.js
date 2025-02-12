const Usermodel = require("../models/Usermodel");

//MIDDLEWARE FUNCTION TO VALIDATE RESET TOKEN

const TokenValidity = async (req, res, next) => {
  const token = req.query.token || req.body.token;

  if (!token) {
    return res.status(400).render("pages/error", {
      error: "Token is not provided",
    });
  }
  try {
    const foundedUser = await Usermodel.findOne({
      resettoken: token,
      tokenexpiry: { $gt: Date.now() }, //VERIFYING WHETHER THE USER HAS A VALID TOKEN OR NOT
    });

    if (!foundedUser) {
      return res.status(403).render("pages/error", {
        error: "Invalid token or expired",
      });
    }
    req.user = foundedUser; //STORING FOUNDED USER  AS REQUESTED USER
    next();
  } catch (err) {
    return response.render("pages/error", {
      error: err.message,
    });
  }
};

module.exports = TokenValidity;
