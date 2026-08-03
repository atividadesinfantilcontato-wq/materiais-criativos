import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

function getFirebaseDb() {
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '';
  const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '';
  const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || '';
  const messagingSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '';
  const appId = process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '';

  if (!apiKey || !projectId) return null;

  const firebaseConfig = {
    apiKey,
    authDomain,
    projectId,
    databaseURL: databaseId && databaseId !== '(default)' ? `https://${databaseId}.firebaseio.com` : undefined,
    messagingSenderId,
    appId,
  };

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = getFirebaseDb();
    if (!db) {
      return res.status(400).json({ error: 'Firebase not configured on server' });
    }

    console.log('Testing Firestore connection in purge handler...');
    const prodSnap = await getDocs(collection(db, 'products'));
    console.log('Products count:', prodSnap.size);

    const snap = await getDocs(collection(db, 'analyticsEvents'));
    const totalBefore = snap.size;

    const eventTypes = new Set<string>();
    const products = new Set<string>();
    const dates = new Set<string>();
    const origins = new Set<string>();
    const cities = new Set<string>();

    snap.forEach((d) => {
      const data = d.data();
      if (data.eventType) eventTypes.add(data.eventType);
      const prod = data.productTitle || data.productSlug || data.productId;
      if (prod) products.add(prod);
      if (data.createdAt) dates.add(data.createdAt.substring(0, 10));
      const orig = data.sourceLabel || data.source;
      if (orig) origins.add(orig);
      const cit = data.city || data.region ? `${data.city || 'Não identificado'}${data.region ? ' / ' + data.region : ''}` : '';
      if (cit) cities.add(cit);
    });

    const auditData = {
      totalBefore,
      eventTypes: Array.from(eventTypes),
      products: Array.from(products),
      dates: Array.from(dates),
      origins: Array.from(origins),
      cities: Array.from(cities),
    };

    if (req.query?.action === 'audit_only') {
      return res.status(200).json({ success: true, audit: auditData });
    }

    let deletedCount = 0;
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(db, 'analyticsEvents', docSnap.id));
      deletedCount++;
    }

    const snapAfter = await getDocs(collection(db, 'analyticsEvents'));

    return res.status(200).json({
      success: true,
      audit: auditData,
      deletedCount,
      totalAfter: snapAfter.size,
    });
  } catch (error: any) {
    console.error('Error purging analytics events:', error, 'Config:', {
      apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    });
    return res.status(500).json({ error: error.message || 'Internal server error', details: error.toString() });
  }
}
