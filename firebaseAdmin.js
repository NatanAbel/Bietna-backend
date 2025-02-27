const admin = require('firebase-admin');
// const serviceAccount = require('./credentials.json');

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
// });

// Instead of requiring the JSON file, use environment variables
const firebaseConfig = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Replace escaped newlines
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  storage_bucket: process.env.FIREBASE_STORAGE_BUCKET
};

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const bucket = admin.storage().bucket();
const auth = admin.auth(); // Firebase Authentication
const firestore = admin.firestore(); // Firestore Database

module.exports = { bucket, auth, firestore };
