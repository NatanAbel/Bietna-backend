const express = require("express");
const router = express.Router();
const axios = require("axios");
const ImageProxy = require("../models/ImageProxyService.model");
const { bucket } = require("../firebaseAdmin");
const { isAuthenticated } = require("../middleware/jwt.middleware");

// Public route to serve images via proxy
router.get("/:proxyId", async (req, res) => {
    
  try {
    const { proxyId } = req.params;
    
    // Find the mapping
    const proxyMapping = await ImageProxy.findOne({ proxyId });
    
    if (!proxyMapping) {
      return res.status(404).send("Image not found");
    }
    
    // Check if the mapping has expired
    if (proxyMapping.expiresAt < new Date()) {
      await ImageProxy.deleteOne({ _id: proxyMapping._id });
      return res.status(404).send("Image link expired");
    }

     // If it's the default image URL, proxy it directly from the source
     if (proxyMapping.originalUrl === process.env.PROFILE_DEFAULT_IMG_URL) {
      const response = await axios.get(proxyMapping.originalUrl, { 
        responseType: 'stream',
        timeout: 5000 // 5 second timeout
      });
      
      // Set appropriate headers
      res.set("Content-Type", proxyMapping.contentType);
      res.set("Cache-Control", "public, max-age=86400"); // Cache for 1 day
      
      return response.data.pipe(res);
    }
    
    
    // Extract the Firebase Storage path
    let decodedPath = "";
    const originalUrl = proxyMapping.originalUrl;
    
    if (originalUrl.includes("/o/")) {
      const urlParts = originalUrl.split("/o/")[1];
      decodedPath = decodeURIComponent(urlParts.split("?")[0]);
    } else if (originalUrl.includes(".appspot.com/")) {
      const urlParts = originalUrl.split(".appspot.com/")[1];
      decodedPath = decodeURIComponent(urlParts.split("?")[0]);
    }
    
    if (!decodedPath) {
      return res.status(404).send("Invalid image path");
    }
    
    // Get the file from Firebase Storage
    const file = bucket.file(decodedPath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      await ImageProxy.deleteOne({ _id: proxyMapping._id });
      return res.status(404).send("Image not found in storage");
    }
    
    // Set appropriate headers
    res.set("Content-Type", proxyMapping.contentType);
    res.set({
      'Cache-Control': 'public, max-age=86400',
      'ETag': true,
      'Vary': 'Accept-Encoding'
    }); // Cache for 1 day
    
    // Stream the file to the response
    const readStream = file.createReadStream();
    readStream.pipe(res);
    
    // Handle errors
    readStream.on("error", (err) => {
      console.error("Error streaming file:", err);
      if (!res.headersSent) {
        res.status(500).send("Error retrieving image");
      }
    });
    
  } catch (error) {
    console.error("Media proxy error:", error);
    res.status(500).send("Server error");
  }
});

// Admin route to manage proxy mappings
router.delete("/admin/cleanup", isAuthenticated, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== "admin") {
    return res.status(403).send("Unauthorized");
  }
  
  try {
    // Delete expired mappings
    const result = await ImageProxy.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    
    res.json({ message: `Deleted ${result.deletedCount} expired mappings` });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).send("Server error");
  }
});

module.exports = router;