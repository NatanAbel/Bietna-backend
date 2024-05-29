const { Schema, model } = require("mongoose");

// TODO: Please make sure you edit the User model to whatever makes sense in this case
const userSchema = new Schema(
  {
    userName: {
      type: String,
      required: [true, 'User name is required.'],
      unique: true,
      lowercase: true,
      trim: true
    },
    email: {
      type: String,
      required:[true, 'email is required.'],
      lowercase: true,
      unique: true
    },
    password: {
      type: String,
      required: [true, 'Password is required.']
    },
    firstName: {
      type: String,
      lowercase: true,
      default: '',
      // required: [true, 'firstName is required.']
    },
    lastName:{
      type: String,
      lowercase: true,
      default: '',
      // required: [true, 'lastName is required.']
    },
    role : {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    bio: {
      type: String,
      default: '',
    },
    published : {
      type: [Schema.Types.ObjectId],
      ref : "House"
    },
    favorites : {
      type: [Schema.Types.ObjectId],
      ref : "House"
    },
    savedSearches: {
      type: [Schema.Types.ObjectId],
      ref : "House"
    },
    profilePicture: {
      type: String,
      default: "https://i.pinimg.com/originals/dd/f0/11/ddf0110aa19f445687b737679eec9cb2.jpg"
    },
    phoneNumber: {
      type: Number,
      default: 0,
    },
    
  },
  {
    // this second object adds extra properties: `createdAt` and `updatedAt`    
    timestamps: true
  }
);

const User = model("User", userSchema);

module.exports = User;
