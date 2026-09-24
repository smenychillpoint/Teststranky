// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA6TjQOHacm45Tdd2VXpvfvTIBeyz7QxaY",
  authDomain: "teststranky-7328e.firebaseapp.com",
  databaseURL: "https://teststranky-7328e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "teststranky-7328e",
  storageBucket: "teststranky-7328e.firebasestorage.app",
  messagingSenderId: "818119314281",
  appId: "1:818119314281:web:833494722ae8a116840bf8",
  measurementId: "G-VNGYTLF8FX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);