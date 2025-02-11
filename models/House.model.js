const { Schema, model } = require("mongoose");

const houseSchema = new Schema(
  {
    address: {
      type: String,
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
    description: {
      type: String,
    },
    sqm: {
      type: Number,
      default: 0,
    },
    city: {
      type: String
    },
    homeType:{
      type: String,
      enum: ["apartment", "store","office","land","condo","house","warehouse"]
    },
    features: {
      type:[String],
      enum:["pool", "garage","outdoor space","internet","tense","fireplace","heating/cooling","furnished","renovated", "elevator"]
    },
    images: {
      type: [String],
      required: [true, "Images are required"],
    },
    latitude: {
      type : Number, 
      default: null, 
    },
  longitude: {
    type : Number, 
    default: null, 
  },
  country: {
    type: String,
    // required: [true, "Country name is required."],
    unique: true,
    trim: true,
  },
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rentalPrice: {
      type: Number,
      default: 0,
    },
    availability: {
      forSale: Boolean,
      forRent: Boolean,
    },
    yearBuilt:{
      type: Number,
      default: 0,
    }
  },
  {
    // this second object adds extra properties: `createdAt` and `updatedAt`
    timestamps: true,
  }
);

const House = model("House", houseSchema);

module.exports = House;
