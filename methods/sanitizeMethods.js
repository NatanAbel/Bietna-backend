const ImageProxy = require("../models/ImageProxyService.model.js");
const House = require("../models/House.model");
const { v4: uuidv4 } = require("uuid");

const DEFAULT_IMG_URL = process.env.PROFILE_DEFAULT_IMG_URL;


// Create a sanitizeUser function
const sanitizeImageUrl = async (url, userId) => {
  if (!url) return null;

  try {
    // Check for an existing mapping for this user
    const existingMapping = await ImageProxy.findOne({ userId: userId });

    // Generate a unique version identifier
    const version = Date.now().toString();

    // Helper function to add version to URL
    const addVersion = (proxyUrl) => `${proxyUrl}?v=${version}`;

    // User uploading a new profile picture from Firebase Storage
    if (url.includes("storage.googleapis.com")) {
      const extension = url.split(".").pop().split("-")[0].split("?")[0];
      const contentType =
        extension === "png"
          ? "image/png"
          : extension === "jpg" || extension === "jpeg"
          ? "image/jpeg"
          : extension === "gif"
          ? "image/gif"
          : "application/octet-stream";

      if (existingMapping) {
        // Update existing mapping with new Firebase Storage URL
        await ImageProxy.findByIdAndUpdate(existingMapping._id, {
          originalUrl: url,
          contentType,
          version,
        });
        return addVersion(
          `${process.env.API_BASE_URL}/media/${existingMapping.proxyId}`
        );
      } else {
        // Create new mapping if none exists
        const proxyId = uuidv4();
        const proxyMapping = await ImageProxy.create({
          originalUrl: url,
          proxyId,
          userId,
          contentType,
          version,
        });
        return addVersion(
          `${process.env.API_BASE_URL}/media/${proxyMapping.proxyId}`
        );
      }
    }

    // User switching to default image
    if (url === DEFAULT_IMG_URL) {
      if (existingMapping) {
        // Update existing mapping to point to default image
        await ImageProxy.findByIdAndUpdate(existingMapping._id, {
          originalUrl: DEFAULT_IMG_URL,
          contentType: "image/jpeg",
          version,
        });
        return addVersion(
          `${process.env.API_BASE_URL}/media/${existingMapping.proxyId}`
        );
      } else {
        // Create new mapping for default image if none exists
        const proxyId = uuidv4();
        const proxyMapping = await ImageProxy.create({
          originalUrl: DEFAULT_IMG_URL,
          proxyId,
          userId,
          contentType: "image/jpeg",
          version,
        });
        return addVersion(
          `${process.env.API_BASE_URL}/media/${proxyMapping.proxyId}`
        );
      }
    }

    //Return existing mapping URL if it exists
    if (existingMapping) {
      return addVersion(
        `${process.env.API_BASE_URL}/media/${existingMapping.proxyId}`
      );
    }

    // Return original URL if no mapping exists and it's not a case we handle
    return url;
  } catch (error) {
    console.error("Error in sanitizeImageUrl:", error);
    return url;
  }
};

// Function to sanitize user data
const sanitizeUser = async (user) => {
  if (!user) return null;

  const userObj = user.toObject ? user.toObject() : { ...user };

  const { password, role, __v, ...safeUserData } = userObj;

  // Encode the user's _id
  if (safeUserData._id) {
    safeUserData._id = `user_${Buffer.from(
      safeUserData._id.toString()
    ).toString("base64")}`;
  }

  // Encode and sanitize published items
  if (safeUserData.published && Array.isArray(safeUserData.published)) {
    safeUserData.published = safeUserData.published.map((item) => ({
      _id: `house_${Buffer.from(item._id.toString()).toString("base64")}`,
    }));
  }

  // Encode and sanitize favorites
  if (safeUserData.favorites && Array.isArray(safeUserData.favorites)) {
    safeUserData.favorites = safeUserData.favorites.map((item) => ({
      _id: `house_${Buffer.from(item._id.toString()).toString("base64")}`,
    }));
  }

  // Encode and sanitize savedSearches
  if (safeUserData.savedSearches && Array.isArray(safeUserData.savedSearches)) {
    safeUserData.savedSearches = safeUserData.savedSearches.map((item) => ({
      _id: `search_${Buffer.from(item._id.toString()).toString("base64")}`,
    }));
  }

  // Mask email
  if (safeUserData.email) {
    const [username, domain] = safeUserData.email.split("@");
    safeUserData.email = `${username.substring(0, 2)}***@${domain}`;
  }

  // Mask phone number
  if (safeUserData.phoneNumber) {
    const phoneStr = safeUserData.phoneNumber.toString();
    safeUserData.phoneNumber = `****${phoneStr.substring(phoneStr.length - 4)}`;
  }

  // Remove null fields
  Object.keys(safeUserData).forEach(key => {
    if (safeUserData[key] === null) {
      delete safeUserData[key];
    }
  });

  // Sanitize profile picture URL
  if (safeUserData.profilePicture) {
    safeUserData.profilePicture = await sanitizeImageUrl(
      safeUserData.profilePicture,
      userObj._id // Use original ID for sanitizeImageUrl
    );
  }

  // Format dates consistently
  if (safeUserData.createdAt) {
    safeUserData.createdAt = new Date(
      safeUserData.createdAt
    ).toLocaleDateString();
  }
  if (safeUserData.updatedAt) {
    safeUserData.updatedAt = new Date(
      safeUserData.updatedAt
    ).toLocaleDateString();
  }

  return safeUserData;
};

// Function to sanitize house data
const sanitizeHouse = (house) => {
  if (!house) return null;

  // Convert to plain object if it's a Mongoose document
  const houseObj = house.toObject ? house.toObject() : { ...house };

  const { __v, ...cleanHouse } = houseObj;

  // Encode the house's _id instead of deleting it
  if (cleanHouse._id) {
    cleanHouse._id = `house_${Buffer.from(cleanHouse._id.toString()).toString(
      "base64"
    )}`;
  }

  // Remove null fields
  Object.keys(cleanHouse).forEach(key => {
    if (cleanHouse[key] === null) {
      delete cleanHouse[key];
    }
  });

  // If postedBy is populated, sanitize it
  if (cleanHouse.postedBy) {
    if (typeof cleanHouse.postedBy === "object") {
      if (Object.keys(cleanHouse.postedBy).length === 0) {
        // If it's an empty object, use the ID if available
        // cleanHouse.postedBy = houseObj.postedBy._id || houseObj.postedBy;
        // Hash or encode the ID
        cleanHouse.postedBy = `user_${Buffer.from(
          houseObj.postedBy._id.toString()
        ).toString("base64")}`;
      } else {
        // If it's a populated object with data, sanitize it
        const {
          password,
          role,
          __v,
          published,
          favorites,
          savedSearches,
          _id,
          ...safePostedBy
        } = cleanHouse.postedBy;
        // Add encoded ID
        safePostedBy.id = `user_${Buffer.from(_id.toString()).toString(
          "base64"
        )}`;
        cleanHouse.postedBy = safePostedBy;
      }
    } else {
      // If it's just an ID string, encode it
      cleanHouse.postedBy = `user_${Buffer.from(
        cleanHouse.postedBy.toString()
      ).toString("base64")}`;
    }
  }

  return cleanHouse;
};

// Function to sanitize and populate house data
const populatedHouse = async (safeUser) => {
  // Extract the original ID from the encoded ID
  const decodeId = (encodedId) => {
    if (!encodedId) return null;
    const prefix = encodedId.startsWith("house_")
      ? "house_"
      : encodedId.startsWith("user_")
      ? "user_"
      : encodedId.startsWith("search_")
      ? "search_"
      : null;

    if (!prefix) return null;

    const base64Id = encodedId.replace(prefix, "");
    return Buffer.from(base64Id, "base64").toString();
  };

  // Process populated data with sanitizeHouse
  const publishedArr = [];
  const favoritesArr = [];
  const savedSearchesArr = [];

  // Process published houses
  if (safeUser.published && safeUser.published.length > 0) {
    await Promise.all(
      safeUser.published.map(async (house) => {
        const originalId = decodeId(house._id);
        if (!originalId) return;
        const publishedHouse = await House.findById(originalId);
        if (publishedHouse) {
          const sanitizedHouse = sanitizeHouse(publishedHouse);
          publishedArr.push(sanitizedHouse);
        }
      })
    );
  }

  // Process favorite houses
  if (safeUser.favorites && safeUser.favorites.length > 0) {
    await Promise.all(
      safeUser.favorites.map(async (house) => {
        const originalId = decodeId(house._id);
        if (!originalId) return;
        const favoriteHouse = await House.findById(originalId);
        if (favoriteHouse) {
          const sanitizedHouse = sanitizeHouse(favoriteHouse);
          favoritesArr.push(sanitizedHouse);
        }
      })
    );
  }

  // Process saved searches
  if (safeUser.savedSearches && safeUser.savedSearches.length > 0) {
    await Promise.all(
      safeUser.savedSearches.map(async (house) => {
        const originalId = decodeId(house._id);
        if (!originalId) return;
        const searchedHouse = await House.findById(originalId);
        if (searchedHouse) {
          const sanitizedHouse = sanitizeHouse(searchedHouse);
          savedSearchesArr.push(sanitizedHouse);
        }
      })
    );
  }

  // Return the populated arrays
  return {
    publishedArr,
    favoritesArr,
    savedSearchesArr,
  };
};

module.exports = {
    sanitizeImageUrl,
    sanitizeUser,
    sanitizeHouse,
    populatedHouse
  };