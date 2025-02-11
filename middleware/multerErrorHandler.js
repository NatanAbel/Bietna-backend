const multer = require("multer");
const multerErrorHandler = (err, req, res, next) => {
    //First function check if the error object is an instance of MulterError.
  if (err instanceof multer.MulterError) {
    // Handle Multer-specific errors
    // File size exceeds the specified limit
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "File size exceeds the 5MB limit.",
      });
    }
    // Number of uploaded files exceeds the allowed limit
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(413).json({
        message: "You can upload a maximum of 10 files.",
      });
    }
    // Generic Multer error handling for other error codes
    return res.status(400).json({
      message: "File upload error occurred.",
    });
  } else if (err) {
    // Handle non-Multer errors
     // Log detailed error information for debugging (server-side only)
     console.error("Non-Multer upload error:", err);
    return res.status(500).json({
      message: "Unknown error occurred during file upload.",
    });
  }
  next(); // Pass control to the next middleware
};

module.exports ={multerErrorHandler}