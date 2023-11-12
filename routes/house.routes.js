const express = require("express");
const multer = require("multer");
const router = express.Router();
const House = require("../models/House.model");
const User = require("../models/User.model");
const path = require("path");

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
router.post("/new", upload.array("image", 10), async (req, res) => {
  try {
    const body = { ...req.body };
    body.availability = JSON.parse(body.availability);
    // Extract the uploaded images from req.files
    const images = req.files.map((file) => file.filename);
    //Append the images to the request body
    body.images = images;

      const newHouse = await House.create(body);
      const findHouse = await House.findById(newHouse._id).populate("postedBy");
      res.status(201).json(findHouse);    
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Error creating a new house" });
  }
});

// Updating existing house
router.put("/:houseId/update", upload.array("image", 10), async (req, res) => {
  try {
    const body = { ...req.body };
    body.availability = JSON.parse(body.availability);
    const { houseId } = req.params;
    
    const house = await House.findById(houseId);

    // Extract the uploaded images from req.files
    const newImages = req.files.map((file) => file.filename);
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

router.delete("/:houseId/delete/", async (req, res) => {
  const { houseId } = req.params;
  try {
    const deleteHouse = await House.findByIdAndDelete(houseId);
    res.status(204).json({ message: "House deleted", deleteHouse });
  } catch (error) {
    console.log(error.message);
  }
});

module.exports = router;
