const { Schema, model } = require("mongoose");

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
      unique: true,
      validate: {
        validator: async function (value) {
          // Basic email regex for structure validation
          const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          // Common fake email pattern (e.g., a@a.a, ab@ab.com)
          const fakeEmailRegex = /^([a-zA-Z]{1,2})@([a-zA-Z]{1,2})\.([a-zA-Z]{2,4})$/;

          // List of disposable email domains (extend as necessary)
          const disposableDomains = ['mailinator.com', 'tempmail.com', '10minutemail.com'];

          // Extract the domain part of the email
          const emailDomain = value.split('@')[1];

          // Check if the email passes all validations
          return (
            basicEmailRegex.test(value) &&
            !fakeEmailRegex.test(value) &&
            !disposableDomains.includes(emailDomain)
          );
        },
        message: props => `${props.value} is not a valid email!`,
      },
    //   validator: async function (value) {
    //     const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    //     const fakeEmailRegex = /^([a-zA-Z]{1,2})@([a-zA-Z]{1,2})\.([a-zA-Z]{2,4})$/;
    //     const disposableDomains = ['mailinator.com', 'tempmail.com', '10minutemail.com'];

    //     const emailDomain = value.split('@')[1];
    //     if (!basicEmailRegex.test(value) || fakeEmailRegex.test(value) || disposableDomains.includes(emailDomain)) {
    //       return false;
    //     }

    //     // Use MailboxLayer to verify the email exists in the real world
    //     try {
    //       const apiKey = process.env.MAILBOXLAYER_API_KEY;  // Ensure your API key is stored in environment variables
    //       const response = await axios.get(`http://apilayer.net/api/check?access_key=${apiKey}&email=${value}&smtp=1&format=1`);
          
    //       if (response.data.smtp_check && response.data.format_valid) {
    //         return true;
    //       } else {
    //         return false;
    //       }
    //     } catch (error) {
    //       console.error("Error verifying email:", error.message);
    //       return false; // Consider failing the validation if there's an error
    //     }
    //   },
    //   message: props => `${props.value} doesn't exist or is not a valid email!`,
    // },
    },
    password: {
      type: String,
      required: [true, 'Password is required.']
    },
    firstName: {
      type: String,
      lowercase: true,
      default: '',
      required: [true, 'firstName is required.']
    },
    lastName:{
      type: String,
      lowercase: true,
      default: '',
      required: [true, 'lastName is required.']
    },
    // country: {
    //   type: String,
    //   // required: [true, "Country name is required."],
    //   unique: true,
    //   trim: true,
    // },
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
    // isVerified: {
    //   type: Boolean,
    //   default: false
    // },
    // emailVerificationToken: {
    //   type:String
    // },
    // emailVerificationExpires: Date,
  },
  {
   
    timestamps: true
  }
);


const User = model("User", userSchema);

module.exports = User;
