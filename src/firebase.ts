import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDgqarJo0D-v9bTHIoRw_j5Wtn8kErr4vU",
  authDomain: "gen-lang-client-0734535922.firebaseapp.com",
  projectId: "gen-lang-client-0734535922",
  storageBucket: "gen-lang-client-0734535922.firebasestorage.app",
  messagingSenderId: "855426537894",
  appId: "1:855426537894:web:ecce99a994b650deb05767"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');

// Initialize Firestore with the custom database ID if specified
const databaseId = "ai-studio-ontimeai-d8676aef-23d9-46bd-9ad3-265398562326";
export const db = getFirestore(app, databaseId);

export { 
  GoogleAuthProvider,
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
};
export type { User };
