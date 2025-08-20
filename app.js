// ℹ️ Gets access to environment variables/settings
// https://www.npmjs.com/package/dotenv
require("dotenv").config();

// ℹ️ Connects to the database
require("./db");

// Handles http requests (express is node js framework)
// https://www.npmjs.com/package/express
const express = require("express");
const compression = require('compression'); 

const app = express();

// Add compression middleware BEFORE HTTPS redirect and other middleware
app.use(compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));


// HTTPS redirect middleware for production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`);
      } else {
        next();
      }
    });
  }

  
// ℹ️ This function is getting exported from the config folder. It runs most pieces of middleware
require("./config")(app);

const { ensureCsrfCookie} = require('./middleware/csrf');
app.use(ensureCsrfCookie);

// 👇 Start handling routes here
const indexRoutes = require("./routes/index.routes");
app.use("/api", indexRoutes);

const houseRoutes = require("./routes/house.routes");
app.use("/houses", houseRoutes);

const authRoutes = require("./routes/auth.routes");
app.use("/auth", authRoutes);

const mediaRoutes = require("./routes/media.routes");
app.use("/media", mediaRoutes);
// ❗ To handle errors. Routes that don't exist or errors that you handle in specific routes
require("./error-handling")(app);

module.exports = app;
