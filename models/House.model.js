const { Schema, model } = require("mongoose");

const houseSchema = new Schema(
  {
    address: {
      type: String,
      required: true,
      maxLength: 200,
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
      max: 999999999,
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
      maxLength: 2000,
      trim: true,
    },
    sqm: {
      type: Number,
      default: 0,
      min: 0,
      max: 100000,
    },
    city: {
      type: String,
    },
    homeType: {
      type: String,
      enum: [
        "apartment",
        "store",
        "office",
        "land",
        "condo",
        "house",
        "warehouse",
      ],
    },
    features: {
      type: [String],
      enum: [
        "pool",
        "garage",
        "outdoor space",
        "internet",
        "tense",
        "fireplace",
        "heating/cooling",
        "furnished",
        "renovated",
        "elevator",
      ],
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0 && v.length <= 20; // Max 20 images
        },
      },
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    country: {
      type: String,
      // required: [true, "Country name is required."],
      required: true,
      trim: true,
    },
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rentalPrice: {
      type: Number,
      default: 0,
      min: 0,
      max: 999999999,
    },
    availability: {
      forSale: Boolean,
      forRent: Boolean,
    },
    yearBuilt: {
      type: Number,
      default: 0,
      min: 0,
      max: 999999999,
    },
  },
  {
    // this second object adds extra properties: `createdAt` and `updatedAt`
    timestamps: true,
  }
);

// Add database indexes for query optimization
// Single field indexes for basic queries
houseSchema.index({ address: 1 });
houseSchema.index({ city: 1 });
houseSchema.index({ country: 1 });
houseSchema.index({ "availability.forRent": 1 });
houseSchema.index({ "availability.forSale": 1 });
houseSchema.index({ price: 1 });
houseSchema.index({ rentalPrice: 1 });
houseSchema.index({ bedrooms: 1 });
houseSchema.index({ bathrooms: 1 });
houseSchema.index({ sqm: 1 });
houseSchema.index({ homeType: 1 });
houseSchema.index({ features: 1 });
houseSchema.index({ postedBy: 1 });
houseSchema.index({ yearBuilt: 1 });
houseSchema.index({ latitude: 1, longitude: 1 });

// Compound indexes for common query patterns
houseSchema.index({ "availability.forRent": 1, rentalPrice: 1 });
houseSchema.index({ "availability.forSale": 1, price: 1 });
houseSchema.index({ city: 1, "availability.forRent": 1 });
houseSchema.index({ city: 1, "availability.forSale": 1 });
houseSchema.index({ country: 1, "availability.forRent": 1 });
houseSchema.index({ country: 1, "availability.forSale": 1 });
houseSchema.index({ bedrooms: 1, "availability.forRent": 1 });
houseSchema.index({ bedrooms: 1, "availability.forSale": 1 });
houseSchema.index({ sqm: 1, "availability.forRent": 1 });
houseSchema.index({ sqm: 1, "availability.forSale": 1 });
houseSchema.index({ yearBuilt: 1, "availability.forRent": 1 });
houseSchema.index({ yearBuilt: 1, "availability.forSale": 1 });
houseSchema.index({ homeType: 1, "availability.forRent": 1 });
houseSchema.index({ homeType: 1, "availability.forSale": 1 });
houseSchema.index({ features: 1, "availability.forRent": 1 });
houseSchema.index({ features: 1, "availability.forSale": 1 });

// Text search indexes for regex queries
houseSchema.index({ address: "text" });
houseSchema.index({ city: "text" });
houseSchema.index({ country: "text" });

// Index for pagination and sorting
houseSchema.index({ createdAt: -1 });

const House = model("House", houseSchema);

module.exports = House;
