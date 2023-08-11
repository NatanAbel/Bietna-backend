const express  = require('express');
const router = express.Router();
const House = require("../models/House.model");
const User = require("../models/User.model");

// get all Houses
router.get("/", async(req, res)=>{
    try{
        const houses = await House.find().populate("postedBy")
        res.status(200).json(houses)
    }catch(error){
        console.log(error.message);
    }

});

// Get a specific House
router.get("/:houseId", async(req, res)=>{
    const {houseId} = req.params;
    try{
        const house = await House.findById(houseId).populate("postedBy")
        res.status(200).json(house)
    }catch(error){
        console.log(error.message);
    }
    
});

// Creating a new house
router.post("/new", async(req, res) => {

    const body = {...req.body}
    try{
        const newHouse = await House.create(body)
        const findHouse = await House.findById(newHouse._id).populate("postedBy")
        res.status(201).json(findHouse)
    }catch(error){
        console.log(error.message);
        res.status(500).json({ message: 'Error creating a new house' });
    }
});

// Updating existing house
router.put("/:houseId/update", async (req, res) => {
    const body = {...req.body}
    const {houseId} = req.params
    try{
        const updateHouse = await House.findByIdAndUpdate(houseId, body, {new:true})
        
        res.status(201).json(updateHouse)

    }catch(error){
        console.log(error.message);
    }
})

router.delete("/:houseId/delete/", async(req, res) => {
    const {houseId} = req.params
    try{
        const deleteHouse = await House.findByIdAndDelete(houseId)
        res.status(204).json({message:"House deleted",deleteHouse})
    }catch(error){
        console.log(error.message)
    }
})

module.exports = router;