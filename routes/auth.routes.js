const express = require("express");
const multer = require("multer");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const House = require("../models/House.model");
const mongoose = require("mongoose");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const {
  updateLimiter,
  loginLimiter,
  uploadLimiter,
} = require("../middleware/rateLimiting.js");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { console } = require("inspector");
const { refreshToken } = require("firebase-admin/app");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { bucket, auth, firestore } = require("../firebaseAdmin");
const { multerErrorHandler } = require("../middleware/multerErrorHandler.js");
const sanitize = require("sanitize-html");
const {
  sanitizeImageUrl,
  sanitizeUser,
  populatedHouse,
} = require("../methods/sanitizeMethods.js");
const {
  processImageUpload,
  validateFiles,
} = require("../methods/imageFileHandlers.js");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
});

// Default image url
const DEFAULT_IMG_URL = process.env.PROFILE_DEFAULT_IMG_URL;

const giveCurrentDateTime = () => {
  const today = new Date();
  const date =
    today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
  const time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  return `${date} ${time}`;
};

const checkWithVirusTotal = async (fileBuffer) => {
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const apiKey = process.env.VIRUSTOTAL_API_KEY; // Add API key to environment
  const url = `https://www.virustotal.com/api/v3/files/${fileHash}`;

  try {
    const response = await axios.get(url, {
      headers: { "x-apikey": apiKey },
    });

    if (response.data.data.attributes.last_analysis_stats.malicious > 0) {
      throw new Error("File flagged as malicious.");
    }
  } catch (error) {
    throw new Error("VirusTotal scan failed or file flagged as malicious.");
  }
};

// Decode the house ID before querying
const decodeId = (encodedId) => {
  if (!encodedId) return null;

  if (encodedId.startsWith("house_")) {
    return Buffer.from(encodedId.replace("house_", ""), "base64").toString();
  }
  return encodedId;
};

// Nodemailer setup
// const transporter = nodemailer.createTransport({
//   service: 'Gmail',
//   auth: {
//     user: process.env.EMAIL,
//     pass: process.env.EMAIL_PASSWORD
//   },
//   // logger: true, // Add this line
//   // debug: true   // Add this line
// });

// router.post("/signup", async (req, res) => {
//   const { userName, email, password } = req.body;
//   try {
//        // Additional check for disposable or fake domains
//     const disposableDomains = ['mailinator.com', 'tempmail.com', '10minutemail.com', 'a.a', 'ab.ab'];
//     const emailDomain = email.split('@')[1];

//     if (disposableDomains.includes(emailDomain)) {
//       return res.status(400).json({ message: "Disposable or invalid email addresses are not allowed." });
//     }

//     // Validate email against regex to catch common fake patterns
//     // const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     // const fakeEmailRegex = /^([a-zA-Z]{1,2})@([a-zA-Z]{1,2})\.([a-zA-Z]{2,4})$/;

//     // if (!basicEmailRegex.test(email) || fakeEmailRegex.test(email)) {
//     //   return res.status(400).json({ message: "Invalid email address." });
//     // }

//       // Enhanced email regex validation
//       const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
//       const fakeEmailRegex = /^([a-zA-Z]{1,2})@([a-zA-Z]{1,2})\.([a-zA-Z]{2,4})$/;

//       if (!emailRegex.test(email) || fakeEmailRegex.test(email)) {
//         return res.status(400).json({ message: "Invalid email address." });
//       }

//     const existingUser = await User.findOne({ $or: [{ userName }, { email }] });

//     if (existingUser) {
//       return res.status(409).json({ message: "Username or email already exists" });
//     }

//     const salt = bcrypt.genSaltSync(13);
//     const hashedPassword = bcrypt.hashSync(password, salt);

//     const emailVerificationToken = crypto.randomBytes(32).toString('hex');
//     const emailVerificationExpires = Date.now() + 3600000; // 1 hour

//     const user = new User({
//       userName,
//       email,
//       password: hashedPassword,
//       emailVerificationToken,
//       emailVerificationExpires
//     });

//     const verificationLink = `http://localhost:5005/auth/verify-email?token=${emailVerificationToken}`;

//     const mailOptions = {
//       to: email,
//       from: process.env.EMAIL,
//       subject: 'Email Verification',
//       text: `Please click on the following link to verify your email: ${verificationLink}`
//     };

//     transporter.sendMail(mailOptions, (err) => {
//       if (err) {
//         console.error("Error sending email:", err.message);
//         return res.status(500).json({ message: "Error sending email" });
//       }
//       res.status(201).json({ message: "User created, please verify your email" });
//     });

//     await user.save();
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

router.post("/signup", async (req, res) => {
  const { userName, email, password, firstName, lastName } = req.body;

  try {
    if (!userName || !email || !password || !firstName || !lastName) {
      res.status(400).json({ message: "Please fill all required fields" });
    }

    // Username validation
    if (userName.length < 4 || userName.length > 20) {
      return res.status(400).json({
        message: "Username must be between 4 and 20 characters.",
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(userName)) {
      return res.status(400).json({
        message: "Username can only contain letters, numbers, and underscores.",
      });
    }

    // Existing validation for disposable or fake domains
    const disposableDomains = [
      "mailinator.com",
      "tempmail.com",
      "10minutemail.com",
      "a.a",
      "ab.ab",
      "s.r",
    ];

    const emailDomain = email.split("@")[1];
    if (disposableDomains.includes(emailDomain)) {
      return res.status(400).json({
        message: "Disposable or invalid email addresses are not allowed.",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ userName }, { email }],
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Username or email already exists" });
    }

    // Additional password validation on server-side
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[@$!%*?&]/.test(password) ||
      password.toLowerCase().includes(userName.toLowerCase())
    ) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters, contain uppercase, lowercase, a number, and a special character. It must not include the username.",
      });
    }

    const salt = bcrypt.genSaltSync(13);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    // const emailVerificationExpires = Date.now() + 3600000; // 1 hour

    const user = new User({
      userName,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      // emailVerificationToken,
      // emailVerificationExpires
    });

    // const verificationLink = `http://localhost:5005/auth/verify-email?token=${emailVerificationToken}`;

    // const mailOptions = {
    //   to: email,
    //   from: process.env.EMAIL,
    //   subject: 'Email Verification',
    //   text: `Please click on the following link to verify your email: ${verificationLink}`
    // };

    // transporter.sendMail(mailOptions, (err) => {
    //   if (err) {
    //     console.error("Error sending email:", err.message);
    //     return res.status(500).json({ message: "Error sending email" });
    //   }
    //   res.status(201).json({ message: "User created, please verify your email" });
    // });

    await user.save();

    // Add before sending response:
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.status(201).json({ message: "User Created" });
  } catch (err) {
    console.error("Error during signup:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// router.get("/verify-email", async (req, res) => {
//   const { token } = req.query;

//   try {
//     const user = await User.findOne({
//       emailVerificationToken: token,
//       emailVerificationExpires: { $gt: Date.now() }
//     });

//     if (!user) {
//       return res.status(400).json({ message: "Invalid or expired token" });
//     }

//     user.isVerified = true;
//     user.emailVerificationToken = undefined;
//     user.emailVerificationExpires = undefined;
//     await user.save();

//     res.status(200).json({ message: "Email verified successfully" });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

router.post("/login", loginLimiter, async (req, res) => {
  const body = req.body;
  try {
    //find if the user exists
    if (!body.userName || !body.password)
      return res.status(400).json({ message: "All fields are required!!" });

    const user = await User.findOne({ userName: body.userName }).select('password role _id').lean().exec();

    if (user) {
      const currentUser = user;
      const passwordCheck = bcrypt.compareSync(
        body.password,
        currentUser.password
      );
      // Check if the password is correct
      if (passwordCheck) {

        const accessToken = jwt.sign(
          {
            data: {
              user: { userId: currentUser._id, role: currentUser.role },
            },
          },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );
        // Create secure cookie with refresh token
        const refreshToken = jwt.sign(
          {
            // exp: Math.floor(Date.now() / 1000) + 60 * 60,
            data: {
              user: { userId: currentUser._id },
            },
          },
          process.env.REFRESH_TOKEN_SECRET,
          { expiresIn: "1d" }
        );

        res.cookie("token", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Security headers
        res.set({
          // X-Content-Type-Options: Prevent MIME type sniffing
          "X-Content-Type-Options": "nosniff",
          // X-Frame-Options: Prevent clickjacking
          "X-Frame-Options": "DENY",
          // Strict-Transport-Security: Enforce HTTPS security
          "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
          // Cache-Control: Prevent caching of sensitive data
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        });

        res.json({ accessToken });
        
      } else {
        res.status(401).json({ message: "Wrong username or password !" });
      }
    } else {
      res.status(401).json({ message: "Wrong username or password !" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send();
  }
});

router.get("/refresh", async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.token) return res.status(401).json({ message: "unauthorized" });
  const refreshToken = cookies.token;
  try {
    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      asyncHandler(async (err, decoded) => {
        if (err) return res.status(403).json({ message: "Forbidden" });

        const userFound = await User.findById(decoded.data.user.userId).exec();
        if (!userFound)
          return res.status(401).json({ message: "Unauthorized" });

        const accessToken = jwt.sign(
          {
            data: {
              user: { userId: userFound._id, role: userFound.role },
            },
          },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );

        // Add inside the jwt.verify callback before sending response:
        res.set(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, private"
        );
        res.json({ accessToken });
      })
    );
  } catch (err) {
    console.error(err);
  }
});

router.get("/logout", (req, res) => {
  // res
  //   .cookie("token", "", {
  //     httpOnly: true,
  //     expires: new Date(0),
  //   })
  //   // .send();
  // res.status(200).json({message: "user logged out"})
  const cookies = req.cookies;
  if (!cookies?.token) return res.sendStatus(204); // No content
  res.clearCookie("token", {
    httpOnly: "true",
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: '/',
  });

  // Add before sending response:
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.json({ message: "Cookie cleared" });
});

router.post("/google", async (req, res, next) => {
  const body = req.body;
  try {
    //find if the user exists
    const user = await User.findOne({ email: body.email });
    if (user) {
      // const accessToken = jwt.sign(
      //   {
      //     // exp: Math.floor(Date.now() / 1000) + 60 * 60,
      //     data: { user: { userId: user._id } },
      //   },
      //   process.env.ACCESS_TOKEN_SECRET,
      //   { expiresIn: "30d" }
      // );

      // res.cookie("token", accessToken, {
      //   httpOnly: true,
      //   secure: process.env.NODE_ENV !== "development",
      //   sameSite: process.env.NODE_ENV === "development" ? "Lax" : "None",
      //   maxAge: 30 * 24 * 60 * 60 * 1000,
      // });

      const accessToken = jwt.sign(
        {
          data: {
            user: { userId: user._id, role: user.role },
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
      );
      // Create secure cookie with refresh token
      const refreshToken = jwt.sign(
        {
          // exp: Math.floor(Date.now() / 1000) + 60 * 60,
          data: {
            user: { userId: user._id },
          },
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "1d" }
      );

      // res.status(200).json({ token });
      res.cookie("token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Add before sending response:
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.status(200).json({ accessToken });
    } else {
      const generatedPassword =
        Math.random().toString(36).split(" ").join("").slice(-8) +
        Math.random().toString(36).split(" ").join("").slice(-8);

      const salt = bcrypt.genSaltSync(13);
      const encryptedPassword = bcrypt.hashSync(generatedPassword, salt);

      const user = await User.create({
        userName:
          body.userName.toLowerCase().replace(/\s/g, "") +
          Math.random().toString(36).split(" ").join("").slice(-4),
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        password: encryptedPassword,
        profilePicture: body.profilePicture,
      });

      // const accessToken = jwt.sign(
      //   {
      //     data: { user: { userId: user._id, role: user.role } },
      //   },
      //   process.env.ACCESS_TOKEN_SECRET,
      //   { expiresIn: "30d" }
      // );

      // res.cookie("token", accessToken, {
      //   httpOnly: true,
      //   secure: process.env.NODE_ENV !== "development",
      //   sameSite: process.env.NODE_ENV === "development" ? "Lax" : "None",
      //   maxAge: 30 * 24 * 60 * 60 * 1000,
      // });

      const accessToken = jwt.sign(
        {
          data: {
            user: { userId: user._id, role: user.role },
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
      );
      // Create secure cookie with refresh token
      const refreshToken = jwt.sign(
        {
          // exp: Math.floor(Date.now() / 1000) + 60 * 60,
          data: {
            user: { userId: user._id },
          },
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "1d" }
      );

      // res.status(200).json({ token });
      res.cookie("token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Add before sending response:
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.status(200).json({ accessToken });
    }
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.get("/verify", isAuthenticated, async (req, res) => {
  // const userId = req.payload.data.user.userId;
  const userId = req.user;

  if (!userId) return res.status(401).json({ message: "Invalid user" });
  try {
    const verifyUser = await User.findById(userId).lean().exec();

    if (!verifyUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const sanitizedUser = await sanitizeUser(verifyUser);

    // Add before sending response:
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.status(200).json({ verified: sanitizedUser });
  } catch (err) {
    console.error(err);
  }
});

router.get("/profile", isAuthenticated, async (req, res) => {
  const userId = req.user;

  try {
    const userFound = await User.findById(userId)
      .populate("published")
      .populate("favorites")
      .populate("savedSearches");

    if (!userFound) {
      return res.status(404).json({ message: "User not found" });
    }

    // Sanitize user data before sending
    const safeUser = await sanitizeUser(userFound);

    // Get populated house data
    const houseData = await populatedHouse(safeUser);

    // Create a clean user object
    const user = {
      ...safeUser,
      published: houseData.publishedArr,
      favorites: houseData.favoritesArr,
      savedSearches: houseData.savedSearchesArr,
    };

    // Add before sending response:
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.status(200).json({ user });
  } catch (err) {
    console.error(err);
  }
});

router.put(
  "/update/profile",
  isAuthenticated,
  updateLimiter,
  async (req, res) => {
    const userId = req.user;
    const sanitizedData = {};

    try {
      const allowedFields = [
        "userName",
        "firstName",
        "lastName",
        "bio",
        "published",
        "savedSearches",
      ];

      // Sanitize and whitelist fields
      allowedFields.forEach((field) => {
        if (req.body[field]) {
          sanitizedData[field] = sanitize(req.body[field], {
            allowedTags: [],
            allowedAttributes: {},
          });
        }
      });

      // Special handling for email with additional validation
      if (req.body.email !== undefined) {
        // Skip masked emails
        if (req.body.email.includes("***")) {
          console.log("Skipping masked email update");
        } else {
          // Validate email format
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          if (!emailRegex.test(req.body.email)) {
            return res.status(400).json({ message: "Invalid email format" });
          }

          sanitizedData.email = sanitize(req.body.email, {
            allowedTags: [],
            allowedAttributes: {},
          });
        }
      }

      // Special handling for phone number
      if (
        req.body.phoneNumber !== undefined &&
        !req.body.phoneNumber.includes("****")
      ) {
        // Add phone validation if needed
        sanitizedData.phoneNumber = sanitize(req.body.phoneNumber, {
          allowedTags: [],
          allowedAttributes: {},
        });
      }

      const userFound = await User.findById(userId);

      if (!userFound) {
        return res.status(404).json({ message: "User not found" });
      }

      // Handle favorites separately to avoid conflicts
      if (req.body.favorites) {
        const favoriteId = req.body.favorites;
        const decodedFavoriteId = decodeId(favoriteId);
        // Check if it's a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(decodedFavoriteId)) {
          return res.status(400).json({ message: "Invalid favorite ID" });
        }

        // Sanitize `favorites` ID (optional, as ObjectId validation already ensures safety)
        const sanitizedFavoriteId = sanitize(decodedFavoriteId, {
          allowedTags: [],
          allowedAttributes: {},
        });

        // Determine if the favourite is already in the user's list
        const isFavorite = userFound.favorites.includes(sanitizedFavoriteId);

        if (isFavorite) {
          // Remove the favorite
          userFound.favorites.pull(sanitizedFavoriteId);
        } else {
          // Add to favorites
          userFound.favorites.addToSet(sanitizedFavoriteId);
        }

        // Save the updated user
        await userFound.save();
      }

      // Update other fields
      if (Object.keys(sanitizedData).length > 0) {
        await User.updateOne({ _id: userId }, sanitizedData);
      }

      // Refetch the updated user data
      const userUpdated = await User.findById(userId)
        .populate("published")
        .populate("favorites")
        .populate("savedSearches");

      // Use the sanitizeUser function and properly handle populated data
      const safeUser = await sanitizeUser(userUpdated);

      // Get populated house data
      const houseData = await populatedHouse(safeUser);

      // Create a clean user object
      const user = {
        ...safeUser,
        published: houseData.publishedArr,
        favorites: houseData.favoritesArr,
        savedSearches: houseData.savedSearchesArr,
      };

      // Add before sending response:
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.status(200).json(user);
    } catch (err) {
      console.error("Error during profile update:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.put(
  "/profile-picture/update",
  isAuthenticated,
  uploadLimiter,
  upload.single("profileImage"),
  multerErrorHandler,
  async (req, res) => {
    const body = { ...req.body };
    const file = req.file;
    const userId = req.user;

    try {
      const userFound = await User.findById(userId);

      if (!userFound) {
        return res.status(404).json({ message: "User not found" });
      }

      if (file) {
        const fileValidation = await validateFiles(file);

        if (!fileValidation.valid) {
          return res.status(400).json({ message: fileValidation.message });
        }

        //checkWithVirusTotal(file.buffer);
        try {
          const dateTime = giveCurrentDateTime();

          // Process image upload
          const downloadUrl = await processImageUpload(file, userId, dateTime);

          // Delete the old profile picture from Firebase Storage, if it exists
          const currentProfilePic = userFound.profilePicture;
          if (currentProfilePic && currentProfilePic !== DEFAULT_IMG_URL) {
            let decodedPath = "";

            // URL contains '/o/' (standard Firebase Storage URL)
            if (currentProfilePic.includes("/o/")) {
              const urlParts = currentProfilePic.split("/o/")[1]; // Get path after '/o/'
              decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
            } else if (currentProfilePic.includes(".appspot.com/")) {
              const urlParts = currentProfilePic.split(".appspot.com/")[1];
              decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
            }

            // Validate the decoded path to ensure it looks like a valid Firebase Storage path
            if (decodedPath && decodedPath.startsWith("profile_picture/")) {
              const fileRef = bucket.file(decodedPath);

              try {
                await fileRef.delete();
                console.log(`Successfully deleted old profile picture.`);
              } catch (err) {
                console.error("Failed to delete old profile picture:", err);
                if (err.code === "storage/object-not-found") {
                  console.log("Old file not found in Firebase Storage.");
                } else {
                  return res.status(500).json({
                    message:
                      "Error deleting old profile picture from Firebase.",
                  });
                }
              }
            }
          }

          await User.updateOne(
            { _id: userId },
            {
              ...body,
              $set: { profilePicture: downloadUrl },
            }
          );

          // Get the sanitized URL before sending response
          const sanitizedUrl = await sanitizeImageUrl(downloadUrl, userId);

          const updatedUser = await User.findById(userId)
            .populate("published")
            .populate("favorites")
            .populate("savedSearches");

          // Sanitize user data before sending
          // const safeUser = await sanitizeUser(updatedUser);

          // Create response with the new sanitized URL
          const safeUser = await sanitizeUser({
            ...updatedUser.toObject(),
            profilePicture: sanitizedUrl, // Use the sanitized URL directly
          });

          // Get populated house data
          const houseData = await populatedHouse(safeUser);

          // Create a clean user object
          const user = {
            ...safeUser,
            published: houseData.publishedArr,
            favorites: houseData.favoritesArr,
            savedSearches: houseData.savedSearchesArr,
          };

          // Add before sending response:
          res.set(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, private"
          );
          res.status(200).json(user);
          // Update the user document in MongoDB with the new profile image URL
          // updateData.profilePicture = downloadUrl;
        } catch (err) {
          console.error("Error during image sanitization:", err);
          return res
            .status(400)
            .json({ message: "Error sanitizing image. Please try again." });
        }
      } else {
        // If no file is uploaded, just return the current profile picture without modification
        const currentProfilePic = userFound.profilePicture;

        if (currentProfilePic !== DEFAULT_IMG_URL) {
          // Find the current proxy mapping
          // const proxyMapping = await ImageProxy.findOne({
          //   userId: userId,
          //   originalUrl: currentProfilePic,
          // });

          let decodedPath = "";

          // URL contains '/o/' (standard Firebase Storage URL)
          if (currentProfilePic.includes("/o/")) {
            const urlParts = currentProfilePic.split("/o/")[1]; // Split and get the path after '/o/'
            decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
          } else {
            // If '/o/' is not present, assume the path is directly in the URL
            const urlParts = currentProfilePic.split(".appspot.com/")[1]; // Get the path after '.appspot.com/'
            decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
          }

          // Validate the decoded path to ensure it looks like a valid Firebase Storage path
          if (!decodedPath || !decodedPath.startsWith("profile_picture/")) {
            console.error("Invalid Firebase Storage path:", decodedPath);
            return res.status(400).json({ message: "Invalid file path." });
          }

          // Get the reference to the Firebase Storage file
          const file = bucket.file(decodedPath);

          try {
            await file.delete();
            console.log(`Successfully deleted file`);

            // Update the existing proxy mapping to point to the default image
            // if (proxyMapping) {
            //   await ImageProxy.findByIdAndUpdate(proxyMapping._id, {
            //     originalUrl: DEFAULT_IMG_URL,
            //     contentType: "image/jpeg",
            //   });

            //   // Keep using the same proxy URL
            //   const proxyUrl = `${process.env.API_BASE_URL}/media/${proxyMapping.proxyId}`;

            // Update user with the same proxy URL
            await User.updateOne(
              { _id: userId },
              {
                ...body,
                $set: { profilePicture: DEFAULT_IMG_URL },
              }
            );

            const updatedUser = await User.findById(userId)
              .populate("published")
              .populate("favorites")
              .populate("savedSearches");

            const safeUser = await sanitizeUser(updatedUser);
            const houseData = await populatedHouse(safeUser);

            const user = {
              ...safeUser,
              published: houseData.publishedArr,
              favorites: houseData.favoritesArr,
              savedSearches: houseData.savedSearchesArr,
            };

            res.set(
              "Cache-Control",
              "no-store, no-cache, must-revalidate, private"
            );
            res.status(200).json(user);
            // }
          } catch (err) {
            console.error(`Failed to delete file:`, err);
            if (err.code === "storage/object-not-found") {
              return res
                .status(404)
                .json({ message: "File not found in Firebase Storage." });
            }
            return res
              .status(500)
              .json({ message: "Error deleting file from Firebase." });
          }
        }
      }

      // Update the user's profile with the new image URL
    } catch (err) {
      console.error("Error during file upload or Firebase handling:", err);
      return res.status(500).json({ message: "Error uploading file" });
    }
  }
);

router.delete("/delete", isAuthenticated, async (req, res) => {
  const userId = req.user;

  try {
    if (userId) {
      const userFound = await User.findById(userId)
        .populate("published")
        .populate("favorites")
        .populate("savedSearches");

      if (!userFound) {
        return res.status(404).json({ message: "User not found" });
      }

      // Delete User's Profile Picture
      // ============================
      const currentProfilePic = userFound.profilePicture;

      if (currentProfilePic !== DEFAULT_IMG_URL) {
        let decodedPath = "";

        // URL contains '/o/' (standard Firebase Storage URL)
        if (currentProfilePic.includes("/o/")) {
          const urlParts = currentProfilePic.split("/o/")[1]; // Split and get the path after '/o/'
          decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
        } else {
          // If '/o/' is not present, assume the path is directly in the URL
          const urlParts = currentProfilePic.split(".appspot.com/")[1]; // Get the path after '.appspot.com/'
          decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
        }

        // Validate the decoded path to ensure it looks like a valid Firebase Storage path
        if (!decodedPath || !decodedPath.startsWith("profile_picture/")) {
          console.error("Invalid Firebase Storage path:", decodedPath);
          return res.status(400).json({ message: "Invalid file path." });
        }

        // Get the reference to the Firebase Storage file
        const file = bucket.file(decodedPath);

        try {
          await file.delete();
          console.log(`Successfully deleted file`);
        } catch (err) {
          console.error(`Failed to delete file :`, err);
          if (err.code === "storage/object-not-found") {
            return res
              .status(404)
              .json({ message: "File not found in Firebase Storage." });
          }
          return res
            .status(500)
            .json({ message: "Error deleting file from Firebase." });
        }
      }

      // Extract IDs of posted houses
      const postedHouses = userFound.published;

      // Delete images from Firebase Storage for all houses the user has posted
      await Promise.all(
        postedHouses.map(async (house) => {
          if (house.images && house.images.length > 0) {
            await Promise.all(
              house.images.map(async (imageUrl) => {
                let decodedPath = "";

                // Decode the Firebase Storage path
                if (imageUrl.includes("/o/")) {
                  const urlParts = imageUrl.split("/o/")[1];
                  decodedPath = decodeURIComponent(urlParts.split("?")[0]);
                } else if (imageUrl.includes(".appspot.com/")) {
                  const urlParts = imageUrl.split(".appspot.com/")[1];
                  decodedPath = decodeURIComponent(urlParts.split("?")[0]);
                }

                // Validate and delete the file from Firebase Storage
                if (decodedPath && decodedPath.startsWith("house_images/")) {
                  const fileRef = bucket.file(decodedPath);
                  try {
                    await fileRef.delete();
                    console.log(`Successfully deleted image`);
                  } catch (err) {
                    console.error(
                      `Failed to delete image: ${decodedPath}`,
                      err
                    );
                    if (err.code !== "storage/object-not-found") {
                      throw new Error("Error deleting images from Firebase.");
                    }
                  }
                }
              })
            );
          }
        })
      );

      // Extract IDs of posted houses and favorite houses
      const postedHouseIds = userFound.published.map((house) => house._id);
      const favoriteHouseIds = userFound.favorites.map((house) => house._id);

      // Delete all the user's posted houses

      await House.deleteMany({ _id: { $in: postedHouseIds } });

      // Remove the favorite houses of the user from other users' favorites lists
      await User.updateMany(
        { favorites: { $in: favoriteHouseIds } },
        { $pull: { favorites: { $in: favoriteHouseIds } } }
      );

      // Remove the user's posted houses from other users' favorites lists
      await User.updateMany(
        { favorites: { $in: postedHouseIds } },
        { $pull: { favorites: { $in: postedHouseIds } } }
      );

      // Delete the user from the mongoDb collection
      await User.findByIdAndDelete(userId);

      // Add before sending response:
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.status(200).json({ message: "User and associated data deleted" });
    } else {
      res.status(400).json({ message: "User ID not provided" });
    }
  } catch (err) {
    console.error(err);
  }
});

module.exports = router;
