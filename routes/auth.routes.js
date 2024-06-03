const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const House = require("../models/House.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const router = express.Router();

router.post("/signup", async (req, res) => {
  const body = req.body;
  try {
    const sameUserAndEmail = await User.find({ userName: body.userName, email: body.email });

    if (sameUserAndEmail.length > 0) {
      res
        .status(409)
        .json({ message: "Username or email already exists", sameUserAndEmail });
    } else {
      const salt = bcrypt.genSaltSync(13);
      const encryptedPassword = bcrypt.hashSync(body.password, salt);

      const user = await User.create({
        userName: body.userName,
        email: body.email,
        password: encryptedPassword,
      });
      res.status(201).json({ message: "User created", user });
    }
  } catch (err) {
    console.log(err.message);
  }
});

router.post("/login", async (req, res) => {
  const body = req.body;
  try {
    //find if the user exists
    const user = await User.find({ userName: body.userName });
    if (user.length > 0) {
      const currentUser = user[0];
      // console.log("currentUser.....",currentUser)
      const passwordCheck = bcrypt.compareSync(
        body.password,
        currentUser.password
      );
      if (passwordCheck) {
        const token = jwt.sign(
          {
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            data: { user: { userId: currentUser._id } },
          },
          process.env.TOKEN_SECRET
        );

        res.status(200).json({ token });
      } else {
        res.status(403).send({ message: "Invalid password" });
      }
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    console.log(err.message);
  }
});

router.post("/google", async (req, res, next) => {
  const body = req.body;
  try {
    //find if the user exists
    const user = await User.findOne({ email: body.email });
    console.log("user.....", user)
    if (user) {
        const token = jwt.sign(
          {
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            data: { user: { userId: user._id } },
          },
          process.env.TOKEN_SECRET
        );

        res.status(200).json({ token });
      
    } else {
      const generatedPassword = Math.random().toString(36).split(" ").join("").slice(-8) + Math.random().toString(36).split(" ").join("").slice(-8);

      const salt = bcrypt.genSaltSync(13);
      const encryptedPassword = bcrypt.hashSync(generatedPassword, salt);

      const user = await User.create({
        userName: body.userName.toLowerCase().replace(/\s/g, "")+ Math.random().toString(36).split(" ").join("").slice(-4),
        email: body.email,
        password: encryptedPassword,
        profilePicture: body.profilePicture,
      });

      const token = jwt.sign(
        {
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
          data: { user: { userId: user._id } },
        },
        process.env.TOKEN_SECRET
      );

      res.status(200).json({ token });
    }
  } catch (err) {
    console.log(err.message);
    next(err )
  }
});

router.get("/verify", isAuthenticated, async (req, res) => {
  try {
    
    if (req.payload) {
      const userId = req.payload.data.user.userId;
      const verifyUser = await User.findById(userId);

      res.status(200).json({ verifyUser });
    }
  } catch (err) {
    console.log(err.message);
  }
});

router.get("/profile", isAuthenticated, async (req, res) => {
  const userId = req.payload.data.user.userId;
  try {
    const userFound = await User.findById(userId ).populate("published").populate("favorites").populate("savedSearches");
    let published = userFound.published;
    let favorites = userFound.favorites;
    let savedSearches = userFound.savedSearches;

    const publishedArr = [];
    const favoritesArr = [];
    const savedSearchesArr = [];

    if(published.length > 0||favorites.length>0||savedSearches.length>0) {

    const houses = await Promise.all(published.map(async (house) => {
        const publishedHouse = await House.findById(house._id).populate("postedBy");
        
        publishedArr.push(publishedHouse);
    }));
    const userFavorites = await Promise.all(favorites.map(async (house) => {
        const favoriteHouses = await House.findById(house._id).populate("postedBy");
        
        favoritesArr.push(favoriteHouses);
      }));
    const userSavedSearch = await Promise.all(savedSearches.map(async (house) => {
        const searchedHouses = await House.findById(house._id).populate("postedBy");
        
        savedSearchesArr.push(searchedHouses);
      }));
    }
    const { ...user } = userFound._doc;
    user.published = publishedArr;
    user.favorites = favoritesArr;
    user.savedSearches = savedSearchesArr;


    res.status(200).json({ user });
  } catch (err) {
    console.log(err.message);
  }
});

// router.put("/profile", isAuthenticated, async (req, res) => {
//   const body = req.body;
//   const userId = req.payload.data.user.userId;
//   try {
//     const userFound = await User.findById(userId)

//     console.log("User found:", userFound);
//             console.log("Favorites before update:", userFound.favorites);
//             console.log("Body favourites:", body.favourites);

//     if (!userFound) {
//       return res.status(404).json({ message: "User not found" });
//     }
//      // Add house to favorites if not already there
//     //  if (!userFound.favorites.includes(body.favourites)) {
//     //   userFound.favorites.push(body.favourites);
//     // }

//     const newFav = userFound.favorites.includes(body.favourites) ?
//             // if it's already favorited remove it 
//             userFound.favorites.filter(fav => fav !== body.favourites) : 
//             // if it's not add to favorites
//             [...userFound.favorites, body.favourites];
             
//             userFound.favorites = newFav

            
//     const userUpdated = await User.findByIdAndUpdate(
//       userFound._id,
//       {favorites: userFound.favorites},
//       { new: true }
//     ).populate("published").populate("favorites").populate("savedSearches");
//     // console.log("userUpdated....", userUpdated);
//     res.status(200).json(userUpdated);
//   } catch (err) {
//     console.log(err.message);
//   }
// });

router.put("/profile", isAuthenticated, async (req, res) => {
  const { body } = req;
  const userId = req.payload.data.user.userId;

  try {
    const userFound = await User.findById(userId);

    if (!userFound) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create update object to update the entire body and manage favorites
    const updateData = { ...body };

    // Determine if the favourite is already in the user's list
    const isFavourite = userFound.favorites.includes(body.favourites);

    if (isFavourite) {
      // If it's already favorited, remove it
      await User.updateOne(
        { _id: userId },
        { 
          ...updateData, 
          $pull: { favorites: body.favourites }
        }
      );
    } else {
      // If it's not favorited, add it
      await User.updateOne(
        { _id: userId },
        { 
          ...updateData, 
          $addToSet: { favorites: body.favourites }
        }
      );
    }

    // Refetch the updated user data
    const userUpdated = await User.findById(userId)
      .populate("published")
      .populate("favorites")
      .populate("savedSearches");

    console.log("User updated:", userUpdated);
    res.status(200).json(userUpdated);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/delete", isAuthenticated, async (req, res) => {
  const userName = req.payload.data.user.userName;
  try {
    if (userName) {
      await User.findOneAndDelete({ userName });
      res.status(200).json({ message: "User deleted" });
    }
  } catch (err) {
    console.log(err.message);
  }
});

module.exports = router;
