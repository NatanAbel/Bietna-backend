const express = require('express');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken")
const User = require('../models/User.model')
const House = require('../models/House.model');
const {isAuthenticated}  = require('../middleware/jwt.middleware');
const router = express.Router();

router.post("/signup", async (req, res) => {
    const body = req.body
    try{
        const salt = bcrypt.genSaltSync(13)
        const encryptedPassword = bcrypt.hashSync(body.passwordHash, salt)

        const user = await User.create({username : body.username , passwordHash: encryptedPassword})

        res.status(201).json({message: "User created", user})
        
    }catch(err){
        console.log(err.message);
    }
});

router.post("/login", async (req, res) => {
    const body = req.body
    try{

        //find if the user exists
        const user = await User.find({username: body.username})
        // console.log("user.....", user)
        if(user.length){
            const currentUser = user[0]
            // console.log("currentUser.....",currentUser)
            const passwordCheck = bcrypt.compareSync(body.passwordHash, currentUser.passwordHash)
            if (passwordCheck){
                const token = jwt.sign({
                    exp: Math.floor(Date.now() / 1000) + (60 * 60),
                    data: {user: {username: currentUser.username}} 
                  }, process.env.TOKEN_SECRET,);
                  
                  res.status(200).json({token});
            }else{
                res.status(403).send({message:"Invalid password"});
            }
        }else{
            res.status(404).json({message:"User not found"})
        }
        
    }catch(err){
        console.log(err.message);
    }
});

router.get("/verify", isAuthenticated,async(req, res)=>{
    try{
        if(req.payload){
            const username = req.payload.data.user.username;
            const verifyUser = await User.findOne({username})
            // console.log("req...",verifyUser);
            res.status(200).json({verifyUser})
        }
    }catch(err){
        console.log(err.message);
    }
});

router.get("/profile", isAuthenticated, async (req, res) => {
    const username = req.payload.data.user.username 
    try{
        const userFound = await User.findOne({username}).populate("published")
        let published = userFound.published  
        const publishedArr = []
        const houses = await Promise.all(published.map(async(house)=>{
            const publishedHouse = await House.findById(house._id).populate("postedBy")
            publishedArr.push(publishedHouse)
        }))

        const {...user} = userFound._doc
        user.published = publishedArr
        console.log("userFound....", user)

        res.status(200).json({user})
    }catch(err){
        console.log(err.message);
    }
});


router.put("/profile", isAuthenticated, async (req, res) => {
    const body = req.body;
    const username = req.payload.data.user.username 
    try{
        const userUpdated = await User.findOneAndUpdate({username:username},body,{new:true}).populate("published")
        res.status(200).json(userUpdated)  
    }catch(err){
        console.log(err.message);
    }
});

router.delete("/delete", isAuthenticated, async(req,res)=>{
    const username = req.payload.data.user.username;
    try{
        if(username){
            await User.findOneAndDelete({username});
            res.status(200).json({message:"User deleted"})
        }
    }catch(err){
        console.log(err.message);
    }
});

module.exports = router 