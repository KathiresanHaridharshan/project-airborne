import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Project Airborne, replace these placeholders with your actual Firebase project settings.
// You can copy this object directly from the Firebase Console (Project Settings > General > Your Apps).
const firebaseConfig = {
  apiKey: "AIzaSyC3CQ9efAnjcry5g0VoHfp9giMLDYcj4Xw",
  authDomain: "project-airbone.firebaseapp.com",
  projectId: "project-airbone",
  storageBucket: "project-airbone.firebasestorage.app",
  messagingSenderId: "762230498647",
  appId: "1:762230498647:web:925f32f83916cc25ebca12",
  measurementId: "G-0533ZMLPER"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

