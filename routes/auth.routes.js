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
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const { multerErrorHandler } = require("../middleware/multerErrorHandler.js");
const sanitize = require("sanitize-html");
// const vision = require("@google-cloud/vision");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
});

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
        message: "Username must be between 4 and 20 characters."
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(userName)) {
      return res.status(400).json({
        message: "Username can only contain letters, numbers, and underscores."
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

    const user = await User.find({ userName: body.userName }).exec();

    if (user.length > 0) {
      // if (!user[0].isVerified) {
      //   return res
      //     .status(403)
      //     .json({ message: "Please verify your email to login !" });
      // }

      const currentUser = user[0];
      const passwordCheck = bcrypt.compareSync(
        body.password,
        currentUser.password
      );
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

        // res.status(200).json({ token });
        res.cookie("token", refreshToken, {
          httpOnly: true,
          secure:true,
          sameSite:"None", // Use "Lax" in dev
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // const { password, role, ...user } = currentUser._doc;

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
    sameSite: "None", // Use "Lax" in dev,
    secure: true,
  });
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
        secure: true,
        sameSite:"None", // Use "Lax" in dev
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

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
        secure: true,
        sameSite: "None", // Use "Lax" in dev
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

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
    const verifyUser = await User.findById(userId);
    const { password, role, ...verified } = verifyUser._doc;

    res.status(200).json({ verified });
  } catch (err) {
    console.error(err);
  }
});

router.get("/profile", isAuthenticated, async (req, res) => {
  // const userId = req.payload.data.user.userId;

  const userId = req.user;

  try {
    const userFound = await User.findById(userId)
      .populate("published")
      .populate("favorites")
      .populate("savedSearches");
    let published = userFound.published;
    let favorites = userFound.favorites;
    let savedSearches = userFound.savedSearches;

    const publishedArr = [];
    const favoritesArr = [];
    const savedSearchesArr = [];

    if (
      published.length > 0 ||
      favorites.length > 0 ||
      savedSearches.length > 0
    ) {
      const houses = await Promise.all(
        published.map(async (house) => {
          const publishedHouse = await House.findById(house._id).populate(
            "postedBy"
          );

          publishedArr.push(publishedHouse);
        })
      );
      const userFavorites = await Promise.all(
        favorites.map(async (house) => {
          const favoriteHouses = await House.findById(house._id).populate(
            "postedBy"
          );

          favoritesArr.push(favoriteHouses);
        })
      );
      const userSavedSearch = await Promise.all(
        savedSearches.map(async (house) => {
          const searchedHouses = await House.findById(house._id).populate(
            "postedBy"
          );

          savedSearchesArr.push(searchedHouses);
        })
      );
    }
    const { password, role, ...user } = userFound._doc;
    user.published = publishedArr;
    user.favorites = favoritesArr;
    user.savedSearches = savedSearchesArr;

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
    const allowedFields = [
      "userName",
      "email",
      "firstName",
      "lastName",
      "bio",
      "published",
      "savedSearches",
      "phoneNumber",
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

    try {
      const userFound = await User.findById(userId);

      if (!userFound) {
        return res.status(404).json({ message: "User not found" });
      }

      // Handle favorites separately to avoid conflicts
      if (req.body.favorites) {
        const favoriteId = req.body.favorites;

        // Check if it's a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(favoriteId)) {
          return res.status(400).json({ message: "Invalid favorite ID" });
        }

        // Sanitize `favorites` ID (optional, as ObjectId validation already ensures safety)
        const sanitizedFavoriteId = sanitize(favoriteId, {
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

        // if (isFavorite) {
        //   // Remove the favorite
        //   await User.updateOne(
        //     { _id: userId },
        //     { $pull: { favorites: favoriteId } }
        //   );
        // } else {
        //   // Add to favorites
        //   await User.updateOne(
        //     { _id: userId },
        //     { $addToSet: { favorites: favoriteId } }
        //   );
        // }
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

      const { password, role, ...updatedUser } = userUpdated._doc;

      res.status(200).json(updatedUser);
    } catch (err) {
      console.error("Error during profile update:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

const validateFiles = async (file) => {
  const validTypes = ["image/jpeg", "image/png", "image/gif"];
  const maxSize = 5 * 1024 * 1024; // 5MB
  // Debug here
  // Define valid magic bytes (file signatures)
  const validSignatures = {
    "image/jpeg": [0xff, 0xd8], // JPEG (FFD8)
    "image/png": [0x89, 0x50], // PNG (8950)
    "image/gif": [0x47, 0x49], // GIF (4749)
  };

  // MIME Type Check (based on file extension or metadata)
  const mimeType = file.mimetype; // Get MIME type based on file extension

  if (!mimeType || !validTypes.includes(mimeType)) {
    return {
      valid: false,
      message: "Invalid MIME type",
    };
  }

  // File Size Check
  if (file.size > maxSize) {
    return {
      valid: false,
      message: "File size exceeds the 5MB limit",
    };
  }

  // Magic Byte Validation
  const fileBuffer = file.buffer.slice(0, validSignatures[mimeType].length); // Slice enough bytes for the signature
  const signature = [...fileBuffer];

  // Check the magic bytes for the expected MIME type
  const expectedSignature = validSignatures[mimeType];

  if (
    !expectedSignature ||
    !signature.every((byte, idx) => byte === expectedSignature[idx])
  ) {
    return {
      valid: false,
      message: "Invalid file signature (magic bytes) or MIME type mismatch",
    };
  }

  return { valid: true };
};

const sanitizeFileName = (originalName) => {
  const sanitized = originalName
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 100)
    .replace(/\.\.+/, "_"); // Remove dangerous characters like "..";
  const uniqueSuffix = uuidv4(); // Use UUID for uniqueness
  return sanitized + "-" + uniqueSuffix;
};

// Background job for processing image uploads
const processImageUpload = async (file, userId, timestamp) => {
  const sanitizedFileName = sanitizeFileName(file.originalname);

  try {
    // Sanitize image (resize and optimize)
    const sanitizedImage = await sharp(file.buffer)
      .resize(800, 800, { fit: "inside" }) // Resize to max 800x800
      .toBuffer();

    const filePath = `profile_picture/${userId}/${sanitizedFileName}-${timestamp}`;
    const blob = bucket.file(filePath);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
      predefinedAcl: "publicRead", // Useing private ACL to restrict access
    });

    return new Promise((resolve, reject) => {
      blobStream.on("error", (err) => reject(err));

      blobStream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${filePath}`;
        resolve(publicUrl);
      });

      blobStream.end(sanitizedImage);
    });
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
};

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

          const updatedUser = await User.findById(userId)
            .populate("published")
            .populate("favorites")
            .populate("savedSearches");

          res.status(200).json(updatedUser);
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
            // Only update the profile picture after the file deletion succeeds
            await User.updateOne(
              { _id: userId },
              {
                ...body,
                $set: { profilePicture: body.profilePicture },
              }
            );

            const updatedUser = await User.findById(userId)
              .populate("published")
              .populate("favorites")
              .populate("savedSearches");
            res.status(200).json(updatedUser);
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
      }
      // Update the user's profile with the new image URL
    } catch (err) {
      console.error("Error during file upload or Firebase handling:", err);
      return res.status(500).json({ message: "Error uploading file" });
    }
  }
);

router.delete("/delete", isAuthenticated, async (req, res) => {
  // const userId = req.payload.data.user.userId;
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

      res.status(200).json({ message: "User and associated data deleted" });
    } else {
      res.status(400).json({ message: "User ID not provided" });
    }
  } catch (err) {
    console.error(err);
  }
});

module.exports = router;
