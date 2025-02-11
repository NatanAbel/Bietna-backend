const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // Limit each IP to 5 requests per 15 minutes
    message: 'Too many login attempts, please try again later.',
    // statusCode: 429, // Status code for rate-limited requests
    // headers: true, // Include rate limit headers in the response
  });

const updateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 profile update attempts per 15 minutes
    message: 'Too many profile update attempts, please try again later.',
    // status: 429, // Status code for rate-limited requests
    // headers: true, // Include rate limit headers in the response
  });

  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 uploads
    message: "Too many file upload attempts. Please try again later.",
  });


module.exports = { loginLimiter, updateLimiter,uploadLimiter };