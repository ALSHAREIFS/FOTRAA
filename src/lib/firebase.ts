import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as Record<string, string | undefined>;
const envApiKey = metaEnv.VITE_FIREBASE_API_KEY;
const envProjectId = metaEnv.VITE_FIREBASE_PROJECT_ID;

const firebaseConfig = {
  apiKey: envApiKey || firebaseConfigData.apiKey,
  authDomain:
    metaEnv.VITE_FIREBASE_AUTH_DOMAIN ||
    (envProjectId ? `${envProjectId}.firebaseapp.com` : firebaseConfigData.authDomain),
  projectId: envProjectId || firebaseConfigData.projectId,
  storageBucket:
    metaEnv.VITE_FIREBASE_STORAGE_BUCKET ||
    (envProjectId ? `${envProjectId}.firebasestorage.app` : firebaseConfigData.storageBucket),
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || firebaseConfigData.appId,
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigData.measurementId || '',
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore:
// If a custom database ID is provided in environment variables, use it.
// Otherwise, use the provisioned firestoreDatabaseId from firebase-applet-config.json.
const customDbId = metaEnv.VITE_FIREBASE_DATABASE_ID || metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
const effectiveDbId = customDbId
  ? customDbId
  : (firebaseConfigData.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId !== '(default)'
      ? firebaseConfigData.firestoreDatabaseId
      : undefined);

export const db = effectiveDbId && effectiveDbId !== '(default)'
  ? getFirestore(app, effectiveDbId)
  : getFirestore(app);
