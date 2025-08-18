// Update bietnaBack/firebaseAdmin.js
const admin = require('firebase-admin');

let firebaseApp = null;
let bucket = null;
let auth = null;
let firestore = null;

const initializeFirebase = () => {
  if (!firebaseApp) {
    const firebaseConfig = {
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      storage_bucket: process.env.FIREBASE_STORAGE_BUCKET
    };

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });

    bucket = admin.storage().bucket();
    auth = admin.auth();
    firestore = admin.firestore();
  }
  return { bucket, auth, firestore };
};

module.exports = {
  get bucket() { return initializeFirebase().bucket; },
  get auth() { return initializeFirebase().auth; },
  get firestore() { return initializeFirebase().firestore; }
};