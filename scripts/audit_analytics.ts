import { config } from 'dotenv';
config();

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '';
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '';
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || '';
const messagingSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '';
const appId = process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '';

console.log('Firebase Project ID:', projectId);

if (!apiKey || !projectId) {
  console.error('Missing Firebase configuration env vars.');
  process.exit(1);
}

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  databaseURL: databaseId ? `https://${databaseId}.firebaseio.com` : undefined,
  messagingSenderId,
  appId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'analyticsEvents'));
  console.log(`TOTAL_EVENTS: ${snap.size}`);

  const eventTypes = new Set<string>();
  const products = new Set<string>();
  const dates = new Set<string>();
  const origins = new Set<string>();
  const cities = new Set<string>();

  snap.forEach((d) => {
    const data = d.data();
    if (data.eventType) eventTypes.add(data.eventType);
    if (data.productTitle || data.productId) products.add(data.productTitle || data.productId);
    if (data.createdAt) dates.add(data.createdAt.substring(0, 10));
    if (data.source || data.sourceLabel) origins.add(data.sourceLabel || data.source);
    if (data.city) cities.add(`${data.city}${data.region ? ' - ' + data.region : ''}`);
  });

  console.log('Event types:', Array.from(eventTypes));
  console.log('Products:', Array.from(products));
  console.log('Dates:', Array.from(dates));
  console.log('Origins:', Array.from(origins));
  console.log('Cities:', Array.from(cities));

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
