import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

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
    databaseURL: databaseId ? `https://${databaseId}.firebaseio.com` : undefined,
    messagingSenderId,
    appId,
  };

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};

    const cityHeader = (req.headers['x-vercel-ip-city'] as string) || '';
    let city = 'Não identificado';
    let geoStatus = 'empty_city';

    if (cityHeader) {
      try {
        city = decodeURIComponent(cityHeader);
        geoStatus = 'ok';
      } catch (e) {
        city = cityHeader;
        geoStatus = 'ok';
      }
    }

    const region = (req.headers['x-vercel-ip-country-region'] as string) || '';
    const country = (req.headers['x-vercel-ip-country'] as string) || '';
    const latitude = (req.headers['x-vercel-ip-latitude'] as string) || '';
    const longitude = (req.headers['x-vercel-ip-longitude'] as string) || '';
    const postalCode = (req.headers['x-vercel-ip-postal-code'] as string) || '';

    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];

    const eventDoc = {
      eventType: payload.eventType || 'page_view',
      visitorId: payload.visitorId || 'v_anon',
      sessionId: payload.sessionId || 's_anon',
      source: payload.source || 'direct',
      sourceLabel: payload.sourceLabel || 'Direto',
      referrer: payload.referrer || '',
      referrerDomain: payload.referrerDomain || '',
      utmSource: payload.utmSource || '',
      utmMedium: payload.utmMedium || '',
      utmCampaign: payload.utmCampaign || '',
      utmContent: payload.utmContent || '',
      utmTerm: payload.utmTerm || '',
      pagePath: payload.pagePath || '/',
      pageTitle: payload.pageTitle || 'Materiais Criativos',
      productId: payload.productId || '',
      productSlug: payload.productSlug || '',
      productTitle: payload.productTitle || '',
      buttonLabel: payload.buttonLabel || '',
      hotmartUrl: payload.hotmartUrl || '',
      deviceType: payload.deviceType || 'desktop',
      browser: payload.browser || 'Other',
      browserLanguage: payload.browserLanguage || '',
      userAgent: payload.userAgent || '',
      // Vercel Geolocation Data
      city,
      region,
      country,
      countryCode: country,
      latitude,
      longitude,
      postalCode,
      geoStatus,
      geoSource: 'vercel_geo',
      createdAt: now.toISOString(),
      dateKey,
      hour: now.getHours(),
    };

    const db = getFirebaseDb();
    if (db) {
      const docRef = await addDoc(collection(db, 'analyticsEvents'), eventDoc);
      return res.status(200).json({ success: true, id: docRef.id, city, geoStatus });
    } else {
      return res.status(200).json({ success: false, reason: 'Firebase not configured on server', city, eventDoc });
    }
  } catch (error: any) {
    console.error('Error tracking event on Vercel API:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
