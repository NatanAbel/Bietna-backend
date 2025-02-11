const admin = require('firebase-admin');
const serviceAccount = require('./credentials.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const bucket = admin.storage().bucket();
const auth = admin.auth(); // Firebase Authentication
const firestore = admin.firestore(); // Firestore Database

module.exports = { bucket, auth, firestore };
