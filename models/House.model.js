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
      enum:["swimming pool", "garage","outdoor space", "tense","fireplace","central heating/cooling","furnished","renovated", "elevator"]
    },
    images: {
      type: [String],
      required: [true, "Images are required"],
    },
    latitude: {
      type : Number
    },
  longitude: {
    type : Number
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
