const { Schema, model } = require("mongoose");

const houseSchema = new Schema({
  address: {
    type :String
},
  price: {
    type: Number,
    default: 0,
  },
  bedrooms: {
    type: Number,
    default: 0,
  },
  bathrooms: {
    type: Number,
    default: 0,
  },
  description : {
    type : String,
  },
  sqm: {
    type: Number,
    default: 0,
  },

  features: [String],

  images:{ 
    type:[String],
    required: [true, "Images are required"],
  },

  postedBy:{
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  rentalPrice: {
    type: Number,
    default: 0,
  },
  availability: {
    forSale: Boolean,
    forRent: Boolean,
  },
});

const House = model("House", houseSchema);

module.exports = House;
