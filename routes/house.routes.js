const express = require("express");
const multer = require("multer");
const router = express.Router();
const House = require("../models/House.model");
const User = require("../models/User.model");
const path = require("path");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { multerErrorHandler } = require("../middleware/multerErrorHandler.js");

const { updateLimiter } = require("../middleware/rateLimiting.js");
const { bucket } = require("../firebaseAdmin");
const sharp = require("sharp"); //Sharp is a high-performance Node.js image processing library that supports image compression and resizing.
const { v4: uuidv4 } = require("uuid");
const sanitize = require("sanitize-html");
// Multer is used to parse data multipart/form-data request body and handle file uploads
// memoryStorage(): Stores files temporarily in the server's RAM (memory)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 10, // Limit to 10 files
  },
  // Multer file filter for validating uploaded file types
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      // If the file type is not allowed, call the callback with an error
      // Create a new MulterError with the code "LIMIT_UNEXPECTED_FILE"
      // and a descriptive message "Invalid file type"
      return cb(
        new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Invalid file type")
      );
    }
    // If the file type is valid, call the callback with no error (null) and "true" to accept the file
    cb(null, true);
  },
});

const giveCurrentDateTime = () => {
  const today = new Date();
  const date =
    today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
  const time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  return `${date} ${time}`;
};

// get all Houses
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);

    const startIndex = (page - 1) * limit;

    const totalHouses = await House.countDocuments();
    if (startIndex >= totalHouses) {
      // If startIndex exceeds the total number of documents, return an appropriate error or default response
      return res.status(404).json({ error: "Requested page not found." });
    }

    const houses = await House.find({});

    const paginatedHouses = houses.slice(startIndex, startIndex + limit);

    const uniqueAreas = [...new Set(houses.map((house) => house.address))];
    const uniqueCities = [...new Set(houses.map((house) => house.city))];

    const results = {
      totalHouses,
      pageCount: Math.ceil(totalHouses / limit),
      result: paginatedHouses,
      uniqueAreas,
      uniqueCities,
    };

    // Check if there is an extra page to display.
    if (startIndex + paginatedHouses.length < totalHouses) {
      results.next = {
        page: page + 1,
      };
    }

    // Codition to make sure page number starts from 1.
    if (startIndex > 0) {
      results.perivous = {
        page: page - 1,
      };
    }

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
  }
});

// Get a specific House
router.get("/:houseId", async (req, res) => {
  const { houseId } = req.params;
  try {
    const house = await House.findById(houseId).populate("postedBy");
    res.status(200).json(house);
  } catch (err) {
    console.error(err);
  }
});


const validateFiles = (files) => {
  const validTypes = ["image/jpeg", "image/png", "image/gif"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  // Define valid magic bytes (file signatures)
  const validSignatures = {
    "image/jpeg": [0xff, 0xd8], // JPEG (FFD8)
    "image/png": [0x89, 0x50], // PNG (8950)
    "image/gif": [0x47, 0x49], // GIF (4749)
  };

  for (const file of files) {
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

    const filePath = `house_images/${userId}/${sanitizedFileName}-${timestamp}`;
    const blob = bucket.file(filePath);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
      predefinedAcl: "publicRead", // Public bucket access
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

// Creating a new house
router.post(
  "/new",
  isAuthenticated,
  updateLimiter,
  upload.array("image", 10),
  multerErrorHandler,
  async (req, res) => {
    try {
      // const userId = req.payload.data.user.userId;
      const userId = req.user;
      // const verifyUser = await User.findById(userId);
      const body = { ...req.body };
      // Whitelist of allowed fields
      const allowedFields = [
        "address",
        "price",
        "bedrooms",
        "bathrooms",
        "description",
        "sqm",
        "city",
        "homeType",
        "features",
        "latitude",
        "longitude",
        "country",
        "rentalPrice",
        "availability",
        "yearBuilt",
      ];

      const numericFields = [
        "price",
        "bedrooms",
        "bathrooms",
        "sqm",
        "latitude",
        "longitude",
        "rentalPrice",
      ];

      const sanitizedData = {};

      // Whitelist and sanitize input fields
      allowedFields.forEach((field) => {
        if (body[field]) {
          sanitizedData[field] = sanitize(body[field], {
            allowedTags: [],
            allowedAttributes: {},
          });
        }
      });

      // Parse JSON fields
      if (sanitizedData.availability) {
        sanitizedData.availability = JSON.parse(sanitizedData.availability);
      }
      if (sanitizedData.features) {
        sanitizedData.features = JSON.parse(sanitizedData.features);
      }

      // Convert numeric fields to numbers
      numericFields.forEach((field) => {
        if (sanitizedData[field]) {
          sanitizedData[field] = parseFloat(sanitizedData[field]);
        }
      });

      // Validate files
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded." });
      }

      const fileValidation = validateFiles(req.files);
      if (!fileValidation.valid) {
        return res.status(400).json({ message: fileValidation.message });
      }

      if (req.files.length < 6) {
        return res
          .status(400)
          .json({ message: "At least six images are required." });
      }

      const dateTime = giveCurrentDateTime();

      // Promise.allSettled() uses to gracefully handle partial upload failures.
      const ImageURLs = await Promise.allSettled(
        req.files.map((file) => processImageUpload(file, userId, dateTime))
      );

      const successfulUploads = ImageURLs.filter(
        (result) => result.status === "fulfilled"
      ).map((result) => result.value);

      if (successfulUploads.length > 10) {
        return res.status(413).json({ message: "Maximum image upload is 10." });
      }

      if (successfulUploads.length < 6) {
        return res.status(400).json({
          message: `Only ${successfulUploads.length} out of ${req.files.length} images uploaded successfully.`,
        });
      }

      // Append the sanitized and uploaded images to the request body
      sanitizedData.images = successfulUploads;
      sanitizedData.postedBy = userId;

      // Validate required fields
      const requiredFields = [
        "address",
        "bedrooms",
        "bathrooms",
        "sqm",
        "description",
        "availability",
      ];

      for (const field of requiredFields) {
        if (!sanitizedData[field]) {
          return res.status(400).json({ message: `${field} is required.` });
        }
      }

      // Validate numeric fields
      for (const field of numericFields) {
        if (sanitizedData[field] && isNaN(sanitizedData[field])) {
          return res
            .status(400)
            .json({ message: `${field} must be a valid number.` });
        }
      }

      const newHouse = await House.create(sanitizedData);

      await User.findByIdAndUpdate(userId, {
        $push: { published: newHouse._id },
      });

      const findHouse = await House.findById(newHouse._id).populate("postedBy");

      res.status(201).json(findHouse);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error creating a new house" });
    }
  }
);

// Updating existing house
router.put(
  "/:houseId/update",
  isAuthenticated,
  updateLimiter,
  upload.array("image", 10),
  multerErrorHandler,
  async (req, res) => {
    try {
      const body = { ...req.body };
      const { houseId } = req.params;
      const userId = req.user;
      // Whitelist of allowed fields
      const allowedFields = [
        "address",
        "price",
        "bedrooms",
        "bathrooms",
        "description",
        "sqm",
        "city",
        "homeType",
        "features",
        "country",
        "rentalPrice",
        "availability",
        "yearBuilt",
      ];

      const numericFields = [
        "price",
        "bedrooms",
        "bathrooms",
        "sqm",
        "rentalPrice",
        "yearBuilt",
      ];

      const sanitizedData = {};

      // Sanitize and whitelist fields
      allowedFields.forEach((field) => {
        if (body[field]) {
          sanitizedData[field] = sanitize(body[field], {
            allowedTags: [],
            allowedAttributes: {},
          });
        }
      });

      // Parse JSON fields
      if (sanitizedData.availability) {
        sanitizedData.availability = JSON.parse(sanitizedData.availability);
      }
      if (sanitizedData.features) {
        sanitizedData.features = JSON.parse(sanitizedData.features);
      }

      // Convert numeric fields to numbers
      numericFields.forEach((field) => {
        if (sanitizedData[field]) {
          sanitizedData[field] = parseFloat(sanitizedData[field]);
        }
      });

      // Validate the house ID
      const house = await House.findById(houseId);
      if (!house) {
        return res.status(404).json({ message: "House not found." });
      }

      // Check if the user is authorized to update the house
      if (String(house.postedBy) !== String(userId)) {
        return res
          .status(403)
          .json({ message: "Unauthorized to update this house." });
      }

      if (req.files || req.files.length !== 0) {
        const fileValidation = validateFiles(req.files);

        if (!fileValidation.valid) {
          return res.status(400).json({ message: fileValidation.message });
        }

        // Check the current number of images
        const totalImagesAfterUpdate = house.images.length + req.files.length;

        if (totalImagesAfterUpdate > 10) {
          return res
            .status(413)
            .json({
              message: `Maximum of 10 images allowed. You currently have ${house.images.length} images.`,
            });
        }

        const dateTime = giveCurrentDateTime();

        // Process image uploads
        const ImageURLs = await Promise.allSettled(
          req.files.map((file) => processImageUpload(file, userId, dateTime))
        );

        const successfulUploads = ImageURLs.filter(
          (result) => result.status === "fulfilled"
        ).map((result) => result.value);

        const failedUploads = ImageURLs.filter(
          (result) => result.status === "rejected"
        );

        if (failedUploads.length > 0) {
          sanitizedData.images = [...house.images, ...successfulUploads];
          return res.status(400).json({
            message: `Failed to upload ${failedUploads.length} images. Only ${successfulUploads.length} out of ${req.files.length} images uploaded successfully.`,
          });
        }
        // Append the new images to the existing images
        sanitizedData.images = [...house.images, ...successfulUploads];
      }

      // Append the new images to the existing images
      const updateHouse = await House.findByIdAndUpdate(
        houseId,
        sanitizedData,
        {
          new: true,
        }
      );

      res.status(200).json(updateHouse);
    } catch (err) {
      console.error("Error updating house:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.delete("/:houseId/image", isAuthenticated, async (req, res) => {
  try {
    const { houseId } = req.params;
    const { imageUrl } = req.body;

    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    house.images = house.images.filter((url) => url !== imageUrl);

    let decodedPath = "";

    // URL contains '/o/' (standard Firebase Storage URL)
    if (imageUrl.includes("/o/")) {
      const urlParts = imageUrl.split("/o/")[1]; // Get path after '/o/'
      decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
    } else if (imageUrl.includes(".appspot.com/")) {
      const urlParts = imageUrl.split(".appspot.com/")[1];
      decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
    }
    // Validate the decoded path to ensure it looks like a valid Firebase Storage path
    if (decodedPath && decodedPath.startsWith("house_images/")) {
      const fileRef = bucket.file(decodedPath);
      try {
        await fileRef.delete();
        console.log(`Successfully deleted old house image.`);
      } catch (err) {
        console.error("Failed to delete old house image:", err);
        if (err.code === "storage/object-not-found") {
          console.log("Old file not found in Firebase Storage.");
        } else {
          return res.status(500).json({
            message: "Error deleting old house image from Firebase.",
          });
        }
      }
    }

    await house.save();

    res.status(200).json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ message: "Failed to delete image" });
  }
});

router.get("/search/result", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;

    // Whitelist of allowed query parameters
    const allowedFields = [
      "search",
      "country",
      "forRent",
      "forSale",
      "minPrice",
      "maxPrice",
      "beds",
      "bath",
      "area",
      "city",
      "houseType",
      "features",
      "squareAreaMin",
      "squareAreaMax",
    ];

    // Sanitize and whitelist input
    const sanitizedQuery = {};
    // allowedFields.forEach((field) => {
    //   if (req.query[field]) {
    //     sanitizedQuery[field] = sanitize(req.query[field], {
    //       allowedTags: [],
    //       allowedAttributes: {},
    //     });
    //   }
    // });
    allowedFields.forEach((field) => {
      if (req.query[field]) {
        // Handle arrays (like houseType and features) differently
        if (Array.isArray(req.query[field])) {
          // Sanitize each array element individually
          sanitizedQuery[field] = req.query[field].map(item => 
            sanitize(item, {
              allowedTags: [],
              allowedAttributes: {},
            })
          );
        } else {
          // Handle regular string values
          sanitizedQuery[field] = sanitize(req.query[field], {
            allowedTags: [],
            allowedAttributes: {},
          });
        }
      }
    });

    const {
      search,
      country,
      forRent,
      forSale,
      minPrice,
      maxPrice,
      beds,
      bath,
      area,
      city,
      houseType,
      features,
      squareAreaMin,
      squareAreaMax,
    } = sanitizedQuery;

    const startIndex = (page - 1) * limit;

    let query = {};

    if (forRent === "true") {
      query["availability.forRent"] = true;
    }
    if (forSale === "true") {
      query["availability.forSale"] = true;
    }

    let rentalPriceFilter = {};
    let salePriceFilter = {};

    if (!isNaN(parseInt(minPrice)) && parseInt(minPrice) > 0) {
      rentalPriceFilter["rentalPrice"] = { $gte: parseInt(minPrice) };
      salePriceFilter["price"] = { $gte: parseInt(minPrice) };
    }
    if (!isNaN(parseInt(maxPrice)) && parseInt(maxPrice) > 0) {
      rentalPriceFilter["rentalPrice"] = rentalPriceFilter["rentalPrice"] || {};
      salePriceFilter["price"] = salePriceFilter["price"] || {};

      if (parseInt(maxPrice) > parseInt(minPrice)) {
        rentalPriceFilter["rentalPrice"].$lte = parseInt(maxPrice);
        salePriceFilter["price"].$lte = parseInt(maxPrice);
      }
    }

    if (
      Object.keys(rentalPriceFilter).length > 0 ||
      Object.keys(salePriceFilter).length > 0
    ) {
      query.$or = [];
      if (Object.keys(rentalPriceFilter).length > 0)
        query.$or.push(rentalPriceFilter);
      if (Object.keys(salePriceFilter).length > 0)
        query.$or.push(salePriceFilter);
    }

    if (parseInt(beds) >= 0 && !isNaN(parseInt(beds))) {
      query.bedrooms = { $gte: parseInt(beds) };
    }
    if (parseInt(bath) >= 0 && !isNaN(parseInt(bath))) {
      query.bathrooms = { $gte: parseInt(bath) };
    }

    if (parseInt(squareAreaMin) > 0 && !isNaN(parseInt(squareAreaMin))) {
      query.sqm = { $gte: parseInt(squareAreaMin) };
    }

    if (parseInt(squareAreaMax) > 0 && !isNaN(parseInt(squareAreaMax))) {
      query.sqm = query.sqm || {};
      query.sqm.$lte = parseInt(squareAreaMax);
    }

    if (search) {
      query.address = query.address || {};
      query.address.$regex = new RegExp(search, "i");
    }

    if (area) {
      query.address = query.address || {};
      query.address.$regex = new RegExp(area, "i");
    }
    if (city) {
      query.city = query.city || {};
      query.city.$regex = new RegExp(city, "i");
    }
    
    if (country) {
      query.country = query.country || {};
      query.country.$regex = new RegExp(country, "i");
    }
    
    if (houseType) {
      query.homeType = { $in: Array.isArray(houseType) ? houseType : [houseType] };
    }
    
    if (features) {
      query.features = { $all: Array.isArray(features) ? features : [features] };
    }

    // Get all matching houses
    const allHouses = await House.find(query);

    const totalHouses = allHouses.length;

    // Check if no houses are found and return a 'no results' message
    if (totalHouses === 0) {
      return res.status(200).json({
        message: "No results found for the selected criteria.",
        results: [],
      });
    }

    // Extract unique areas and cities to display on the area and city dropdown filters respectively.
    const houses = await House.find({});

    let uniqueAreas;
    let uniqueCities;

    if (forRent === "true" || forSale === "true") {
      const filteredHouses = houses.filter((house) => {
        if (forRent === "true") {
          return house.availability.forRent;
        } else if (forSale === "true") {
          return house.availability.forSale;
        }
      });

      uniqueAreas = [...new Set(filteredHouses.map((house) => house.address))];
      uniqueCities = [...new Set(filteredHouses.map((house) => house.city))];
    } else {
      uniqueAreas = [...new Set(houses.map((house) => house.address))];
      uniqueCities = [...new Set(houses.map((house) => house.city))];
    }

    const paginatedHouses = allHouses.slice(startIndex, startIndex + limit);

    const results = {
      totalHouses,
      pageCount: Math.ceil(totalHouses / limit),
      result: paginatedHouses,
      uniqueAreas,
      uniqueCities,
    };

    // Pagination links
    if (startIndex > 0) {
      results.previous = {
        page: page - 1,
      };
    }
    if (startIndex + paginatedHouses.length < totalHouses) {
      results.next = {
        page: page + 1,
      };
    }
    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Backend routes for fetching enum values
router.get("/homeTypes/enumValues", async (req, res) => {
  try {
    const enumValues = House.schema.path("homeType").options.enum;
    res.status(200).json(enumValues);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Error fetching enum values for homeType" });
  }
});

router.get("/enumValues/features", async (req, res) => {
  try {
    const enumValues = House.schema.path("features").options.enum;
    res.status(200).json(enumValues);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Error fetching enum values for features" });
  }
});

router.delete("/:houseId/delete", isAuthenticated, async (req, res) => {
  const { houseId } = req.params;
  // const userId = req.payload.data.user.userId;
  const userId = req.user;

  try {
    // Find the house to get the image filenames
    const house = await House.findById(houseId).populate("postedBy");

    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    // Delete images from Firebase Storage
    await Promise.all(
      house.images.map(async (imageUrl) => {
        let decodedPath = "";
        // URL contains '/o/' (standard Firebase Storage URL)
        if (imageUrl.includes("/o/")) {
          const urlParts = imageUrl.split("/o/")[1]; // Get path after '/o/'
          decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
        } else if (imageUrl.includes(".appspot.com/")) {
          const urlParts = imageUrl.split(".appspot.com/")[1];
          decodedPath = decodeURIComponent(urlParts.split("?")[0]); // Decode and remove query string
        }

        // Validate the decoded path to ensure it looks like a valid Firebase Storage path
        if (decodedPath && decodedPath.startsWith("house_images/")) {
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
                message: "Error deleting old profile picture from Firebase.",
              });
            }
          }
        }
      })
    );
    // Remove the houseId from the published and favorites arrays of the user who posted the house
    const user = await User.findByIdAndUpdate(userId, {
      $pull: { published: houseId, favorites: houseId },
    });

    // Remove the houseId from the favorites arrays of all users who have it
    await User.updateMany(
      { favorites: houseId },
      { $pull: { favorites: houseId } }
    );

    const deleteHouse = await House.findByIdAndDelete(houseId);

    res.status(204).json({ message: "House deleted", deleteHouse });
  } catch (err) {
    console.error(err);
  }
});
module.exports = router;
