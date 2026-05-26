const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    const localPath = path.join(__dirname, '../../firebaseServiceAccount.json');
    if (fs.existsSync(localPath)) {
      serviceAccount = require(localPath);
    } else {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY and firebaseServiceAccount.json not found.');
    }
  }
} catch (error) {
  console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error.message);
}

if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'chatserver-e8b0b.firebasestorage.app'
  });
  console.log('✅ Firebase Admin initialized.');
} else if (!serviceAccount) {
  console.warn('⚠️ Firebase Admin NOT initialized. Phone auth will fail.');
}

module.exports = admin;
