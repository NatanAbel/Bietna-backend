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
        .json({ message: "User name already exists", sameUserAndEmail });
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
    console.log("user.....", user)
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
            data: { user: { userName: currentUser.userName } },
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
            data: { user: { userName: user.userName } },
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
          data: { user: { userName: user.userName } },
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
      const userName = req.payload.data.user.userName;
      const verifyUser = await User.findOne({ userName });
      // console.log("req...",verifyUser);
      res.status(200).json({ verifyUser });
    }
  } catch (err) {
    console.log(err.message);
  }
});

router.get("/profile", isAuthenticated, async (req, res) => {
  const userName = req.payload.data.user.userName;
  try {
    const userFound = await User.findOne({ userName }).populate("published");
    let published = userFound.published;
    const publishedArr = [];
    const houses = await Promise.all(
      published.map(async (house) => {
        const publishedHouse = await House.findById(house._id).populate(
          "postedBy"
        );
        publishedArr.push(publishedHouse);
      })
    );

    const { ...user } = userFound._doc;
    user.published = publishedArr;
    console.log("userFound....", user);

    res.status(200).json({ user });
  } catch (err) {
    console.log(err.message);
  }
});

router.put("/profile", isAuthenticated, async (req, res) => {
  const body = req.body;
  const userName = req.payload.data.user.userName;
  try {
    const userUpdated = await User.findOneAndUpdate(
      { userName: userName },
      body,
      { new: true }
    ).populate("published");
    res.status(200).json(userUpdated);
  } catch (err) {
    console.log(err.message);
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
