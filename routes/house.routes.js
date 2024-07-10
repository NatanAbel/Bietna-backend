const express = require("express");
const multer = require("multer");
const router = express.Router();
const House = require("../models/House.model");
const User = require("../models/User.model");
const path = require("path");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const sharp = require("sharp"); //Sharp is a high-performance Node.js image processing library that supports image compression and resizing.
const fs = require('fs');

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
    // const houses = await House.find().populate("postedBy");
    // res.status(200).json(houses);
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);

    const startIndex = (page - 1) * limit;
    
    const totalHouses = await House.countDocuments();
    if (startIndex >= totalHouses ) {
      // If startIndex exceeds the total number of documents, return an appropriate error or default response
      return res.status(404).json({ error: 'Requested page not found.' });
    }
    
    const houses = await House.find({}).skip(startIndex)
    .limit(limit);
    const results = {};

    
    results.totalHouses =  totalHouses
    results.pageCount = Math.ceil(totalHouses/ limit);
    //Condition to check if there is exrta page to display.

     // Check if there is an extra page to display.
     if (startIndex + houses.length < totalHouses) {
      results.next = {
        page: page + 1
      };
    }

    // Codition to make sure page number starts from 1.
    if (startIndex > 0) {
      results.perivous = {
        page: page - 1,
      };
    }
    // Results for one page
    results.result = houses
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
router.post(
  "/new",
  isAuthenticated,
  upload.array("image", 10),
  async (req, res) => {
    try {
      const userId = req.payload.data.user.userId;
      // const verifyUser = await User.findById(userId);
      const body = { ...req.body };
      // parsing avelability from string to object
      body.availability = JSON.parse(body.availability);
      body.features = JSON.parse(body.features);
      // Extract the uploaded images from req.files
      const images = req.files.map((file) => file.filename);
      // Extract the uploaded images from req.files
      // console.log("images......",req.file)
      // const images = await Promise.all(
      //   req.files.map(async (file) => {
      //     try{
      //      // Read the file into a buffer
      //      const fileBuffer = await fs.readFile(file.path);
      //      // Process the image with sharp
      //     const compressedImageBuffer = await sharp(fileBuffer)
      //       .resize(800) // Resize the image to a maximum width of 800 pixels
      //       .jpeg({ quality: 80 }) // Set JPEG quality to 80% to reduce the file size while maintaining reasonable image quality.
      //       .toBuffer(); //convert the processed image back to a buffer.
            
      //     return {
      //       buffer: compressedImageBuffer,
      //       filename: file.filename, // Use original filename
      //     };
      //   } catch (imageError) {
      //     console.error(`Error processing file ${file.filename}:`, imageError);
      //     // Handle the error, e.g., skip this file or return an error response
      //     throw imageError; // Rethrow the error to be caught by the outer try-catch
      //   }
      //   })
      // );
      // Validate the array of images ==> min 2 photos
      if (images.length < 3) {
        return res
          .status(400)
          .json({ message: "At least two images are required." });
      }
      //Append the images to the request body
     
      // body.images = images.filename;
      body.images = images
      body.postedBy = userId;
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
      const user = await User.findByIdAndUpdate(userId, {
        $push: { published: newHouse._id },
      });

      const findHouse = await House.findById(newHouse._id).populate("postedBy");
      
      console.log("user.....",user)
      console.log("postedBy.....",findHouse.postedBy)
      res.status(201).json(findHouse);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: "Error creating a new house"});
    }
  }
);

// Updating existing house
router.put(
  "/:houseId/update",
  isAuthenticated,
  upload.array("image", 10),
  async (req, res) => {
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
  }
);

router.get("/search/result", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 3;
    const startIndex = (page - 1) * limit;
    const {search, forRent, forSale, minPrice, maxPrice, beds, bath, area, city, houseType, features, squareAreaMin, squareAreaMax} = req.query
    
    let query = {};
    // Apply filters if provided
    if (forRent === "true") {
      query['availability.forRent'] = forRent === 'true';
    }
    if (forSale === "true") {
      query['availability.forSale'] = forSale === 'true';
    }

    let rentalPriceFilter = {};
    let salePriceFilter = {};

    if (!isNaN(parseInt(minPrice)) && parseInt(minPrice) > 0) {
      rentalPriceFilter['rentalPrice'] = { $gte: parseInt(minPrice) };
      salePriceFilter['price'] = { $gte: parseInt(minPrice) };
    }
    if (!isNaN(parseInt(maxPrice)) && parseInt(maxPrice) > 0) {
      rentalPriceFilter['rentalPrice'] = rentalPriceFilter['rentalPrice'] || {};
      rentalPriceFilter['rentalPrice'].$lte = parseInt(maxPrice);
      salePriceFilter['price'] = salePriceFilter['price'] || {};
      salePriceFilter['price'].$lte = parseInt(maxPrice);
    }

    if (Object.keys(rentalPriceFilter).length > 0 || Object.keys(salePriceFilter).length > 0) {
      query.$or = [];
      if (Object.keys(rentalPriceFilter).length > 0) query.$or.push(rentalPriceFilter);
      if (Object.keys(salePriceFilter).length > 0) query.$or.push(salePriceFilter);
    }

    if (parseInt(beds) >1 && !isNaN(parseInt(beds))) {
      query.bedrooms = { $gte: parseInt(beds) };
   }
   if (parseInt(bath) > 1 && !isNaN(parseInt(bath))) {
      query.bathrooms = { $gte: parseInt(bath) };
   }

   if (parseInt(squareAreaMin) >0  && !isNaN(parseInt(squareAreaMin))) {
    query.sqm = { $gte: parseInt(squareAreaMin) };
  }

  if (parseInt(squareAreaMax) > 0 && !isNaN(parseInt(squareAreaMax))) {
    query.sqm = query.sqm || {};
    query.sqm.$lte = parseInt(squareAreaMax);
  }

    if (search) {
      query.address = { $regex: new RegExp(search, 'i') };
    }

    if (area) {
      query.address = { $regex: new RegExp(area, 'i') };
    }
    if (city) {
      query.city = { $regex: new RegExp(city, 'i') };
    }
    if (houseType) {
      query.homeType = { $in: houseType };
    }
    if (features) {
      query.features = { $all: features };
    }
    
    const totalHouses = await House.countDocuments(query);
    if (startIndex >= totalHouses ) {
      // If startIndex exceeds the total number of documents, return an appropriate error or default response
      return res.status(404).json({ error: 'Requested page not found.' });
    }
    

    const houses = await House.find(query)
    .limit(limit)
    .skip(startIndex)
      

    const results = {
      totalHouses,
      pageCount: Math.ceil(totalHouses / limit),
      result: houses,
    };

    // Pagination links
    if (startIndex > 0) {
      results.previous = {
        page: page - 1,
      };
    }
    if (startIndex + houses.length < totalHouses) {
      results.next = {
        page: page + 1,
      };
      
    } 
  
    
    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
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


router.delete("/:houseId/delete", isAuthenticated, async (req, res) => {
  const { houseId } = req.params;
  const userId = req.payload.data.user.userId;
  
  try {

    // Find the house to get the image filenames
    const house = await House.findById(houseId).populate("postedBy");

    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    // Delete the image files from the filesystem
    const imageFiles = house.images;
    const imagePath = path.join(__dirname, '..', 'public', 'images');
    console.log("imagePath.....", imagePath);

    for (const filename of imageFiles) {
      const filePath = path.join(imagePath, filename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Successfully deleted file ${filename}`);
        } else {
          console.warn(`File ${filename} does not exist at path ${filePath}`);
        }
      } catch (err) {
        console.error(`Failed to delete file ${filename}:`, err);
      }
    }

    
     // Remove the houseId from the published and favorites arrays of the user who posted the house
    const user = await User.findByIdAndUpdate(userId, {
        $pull: { published: houseId,favorites:houseId},
      });

     // Remove the houseId from the favorites arrays of all users who have it
     await User.updateMany(
      { favorites: houseId },
      { $pull: { favorites: houseId } }
    );

    const deleteHouse = await House.findByIdAndDelete(houseId);

    res.status(204).json({ message: "House deleted",deleteHouse });

  } catch (error) {
    console.log(error.message);
  }
});
module.exports = router;
