const express = require('express');
const User = require('../models/User.model')
const bcrypt = require("bcryptjs");
const House = require('../models/House.model');
const router = express.Router();

router.post("/signup", async (req, res) => {
    try{
        const body = req.body
        const salt = bcrypt.genSaltSync(13)
        const encryptedPassword = bcrypt.hashSync(body.passwordHash, salt)

        const user = await User.create({username : body.username , passwordHash: encryptedPassword})

        res.status(201).json({user:user ,message: "User created"})
        
    }catch(err){
        console.log(err);
    }
})

module.exports = router 