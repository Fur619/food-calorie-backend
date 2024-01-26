const jwt = require("jsonwebtoken");

const middleware = (req, res, next) => {
  try {
    const accessToken = req.headers.authorization;
    if (!accessToken) {
      return res.status(401).send({
        message: "Authentication Failed",
      });
    }
    const token = accessToken.split("Bearer ")[1];
    const user = jwt.verify(token, process.env.JWT_SECRET, {});
    if (!user) {
      return res.status(401).send({
        message: "Authentication Failed",
      });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).send({
      message: "Authentication Failed",
    });
  }
};

module.exports = middleware;
