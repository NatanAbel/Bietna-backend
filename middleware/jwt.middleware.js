const jwt = require("jsonwebtoken");

const isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ message: "Unauthorized" });
  const token = authHeader.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Forbidden" }); //invalid token
        req.user = decoded.data.user.userId
        req.role = decoded.data.user.role
        next()
      });
};

// Export the middleware so that we can use it to create a protected routes
module.exports = {
  isAuthenticated,
};
