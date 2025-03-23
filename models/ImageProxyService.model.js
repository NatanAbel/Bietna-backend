const mongoose = require("mongoose");

const imageProxySchema = new mongoose.Schema(
  {
    originalUrl: {
      type: String,
      required: true,
      index: true
    },
    proxyId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    contentType: {
      type: String,
      required: true
    },
    // expiresAt: {
    //   type: Date,
    //   default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year by default
    // }
  },
  { timestamps: true }
);

// Add index for expiration cleanup
// imageProxySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ImageProxy = mongoose.model("ImageProxy", imageProxySchema);

module.exports = ImageProxy;