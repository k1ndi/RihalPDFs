const { initializeApp } = require('firebase/app');
const { getStorage } = require('firebase/storage');
const { getFirestore } = require('firebase/firestore');
const admin = require('firebase-admin');
const serviceAccount = require('./rihal-6efda-firebase-adminsdk-1ahcl-d48abafaf2.json');

const firebaseConfig = {
    apiKey: "AIzaSyC46wNR1WjBVUzrKFp_lzFst175Nq7p9Ik",
    authDomain: "rihal-6efda.firebaseapp.com",
    databaseURL: "https://rihal-6efda-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "rihal-6efda",
    storageBucket: "rihal-6efda.appspot.com",
    messagingSenderId: "30548795887",
    appId: "1:30548795887:web:6c7d70c8df196b749e561a"
  };

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    apiKey: "AIzaSyC46wNR1WjBVUzrKFp_lzFst175Nq7p9Ik",
    authDomain: "rihal-6efda.firebaseapp.com",
    databaseURL: "https://rihal-6efda-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "rihal-6efda",
    storageBucket: "rihal-6efda.appspot.com",
    messagingSenderId: "30548795887",
    appId: "1:30548795887:web:6c7d70c8df196b749e561a",
   
});

const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);
const firestore = getFirestore(firebaseApp);

module.exports = { admin, storage, firestore };