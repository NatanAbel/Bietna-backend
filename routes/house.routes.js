const express = require("express");
const multer = require("multer");
const router = express.Router();
const House = require("../models/House.model");
const User = require("../models/User.model");
const path = require("path");
const { isAuthenticated } = require("../middleware/jwt.middleware");
// const sharp = require('sharp'); //Sharp is a high-performance Node.js image processing library that supports image compression and resizing.

// Configure the storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/images"); // Define the directory where uploaded files should be stored
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    ); //
  },
});

const upload = multer({ storage: storage }); // Create an instance of multer

// get all Houses
router.get("/", async (req, res) => {
  try {
    const houses = await House.find().populate("postedBy");
    res.status(200).json(houses);
  } catch (error) {
    console.log(error.message);
  }
});

router.get("/paginatedHouse", async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const houses = await House.find({});
    const results = {};
    results.totalHouses = houses.length;
    results.pageCount = Math.ceil(houses.length / limit);
    //Condition to check if there is exrta page to display.
    if (endIndex < houses.length) {
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
    // Results for one page
    results.result = houses.splice(startIndex, endIndex);
    // console.log(results)
    res.status(200).json(results);
  } catch (error) {
    console.log(error.message);
  }
});

// Get a specific House
router.get("/:houseId", async (req, res) => {
  const { houseId } = req.params;
  try {
    const house = await House.findById(houseId).populate("postedBy");
    res.status(200).json(house);
  } catch (error) {
    console.log(error.message);
  }
});

// Creating a new house
router.post("/new",isAuthenticated ,upload.array("image", 10), async (req, res) => {
  try {
    const body = { ...req.body };
    // console.log("body......", body);
    // parsing avelability from string to object
    body.availability = JSON.parse(body.availability);
    body.features = JSON.parse(body.features);
    // Extract the uploaded images from req.files
    const images = req.files.map((file) => file.filename);
    // Extract the uploaded images from req.files
    // const images = await Promise.all(req.files.map(async (file) => {
    //   const compressedImageBuffer = await sharp(file.path)
    //     .resize(800) // Resize the image to a maximum width of 800 pixels
    //     .jpeg({ quality: 80 }) // Set JPEG quality to 80% to reduce the file size while maintaining reasonable image quality.
    //     .toBuffer(); //convert the processed image back to a buffer.
    //   return {
    //     buffer: compressedImageBuffer,
    //     filename: file.filename // Use original filename
    //   };
    // }));
    // Validate the array of images ==> min 2 photos
    if (images.length < 3) {
      return res
        .status(400)
        .json({ message: "At least two images are required." });
    }
    //Append the images to the request body
    body.images = images;

    const requiredFields = [
      "address",
      "bedrooms",
      "bathrooms",
      "sqm",
      "description",
      "availability",
      "images",
    ];
    const numericFields = [
      "price",
      "bedrooms",
      "bathrooms",
      "sqm",
      "rentalPrice",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return res.status(400).json({ message: `${field} is required.` });
      }
    }

    for (const field of numericFields) {
      if (isNaN(body[field])) {
        return res
          .status(400)
          .json({ message: `${field} must be a valid number.` });
      }
    }

    const newHouse = await House.create(body);
    const findHouse = await House.findById(newHouse._id).populate("postedBy");
    res.status(201).json(findHouse);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Error creating a new house" });
  }
});

// Updating existing house
router.put("/:houseId/update",isAuthenticated, upload.array("image", 10), async (req, res) => {
  try {
    const body = { ...req.body };
    body.availability = JSON.parse(body.availability);
    body.features = JSON.parse(body.features);
    const { houseId } = req.params;

    const house = await House.findById(houseId);

    // Extract the uploaded images from req.files
    const newImages = req.files.map((file) => file.filename);

    // Extract the uploaded images from req.files
    // const newImages = await Promise.all(req.files.map(async (file) => {
    //   const compressedImageBuffer = await sharp(file.path)
    //     .resize(800) // Resize the image to a maximum width of 800 pixels
    //     .jpeg({ quality: 80 }) // Set JPEG quality to 80%
    //     .toBuffer(); // Convert the image to a buffer
    //   return {
    //     buffer: compressedImageBuffer,
    //     filename: file.filename // Use original filename
    //   };
    // }));

    // Append the new images to the existing images
    body.images = [...house.images, ...newImages];

    const updateHouse = await House.findByIdAndUpdate(houseId, body, {
      new: true,
    });

    res.status(200).json(updateHouse);
  } catch (error) {
    console.log(error.message);
  }
});

// Backend routes for fetching enum values
router.get("/homeTypes/enumValues", async (req, res) => {
  try {
    const enumValues = House.schema.path("homeType").options.enum;
    res.status(200).json(enumValues);
  } catch (error) {
    console.log(error.message);
    res
      .status(500)
      .json({ message: "Error fetching enum values for homeType" });
  }
});

router.get("/enumValues/features", async (req, res) => {
  try {
    const enumValues = House.schema.path("features").options.enum;
    res.status(200).json(enumValues);
  } catch (error) {
    console.log(error.message);
    res
      .status(500)
      .json({ message: "Error fetching enum values for features" });
  }
});
router.delete("/:houseId/delete",isAuthenticated ,async (req, res) => {
  const { houseId } = req.params;
  try {
    const deleteHouse = await House.findByIdAndDelete(houseId);
    res.status(204).json({ message: "House deleted", deleteHouse });
  } catch (error) {
    console.log(error.message);
  }
});

module.exports = router;
