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

console.log('Firebase Config:', {
  apiKey: apiKey ? '***' : 'MISSING',
  projectId,
  databaseId,
  authDomain
});

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  databaseURL: databaseId && databaseId !== '(default)' ? `https://${databaseId}.firebaseio.com` : undefined,
  messagingSenderId,
  appId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

async function run() {
  console.log('=== AUDITORIA DE ANALYTICS (ANTES) ===');
  const snap = await getDocs(collection(db, 'analyticsEvents'));
  const totalBefore = snap.size;
  console.log(`Total de eventos antes: ${totalBefore}`);

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

  console.log('Tipos de evento encontrados:', Array.from(eventTypes));
  console.log('Produtos com eventos:', Array.from(products));
  console.log('Datas dos eventos:', Array.from(dates));
  console.log('Origens encontradas:', Array.from(origins));
  console.log('Cidades/estados encontrados:', Array.from(cities));

  console.log('\n=== LIMPANDO COLEÇÃO analyticsEvents ===');
  let deletedCount = 0;
  for (const docSnap of snap.docs) {
    await deleteDoc(doc(db, 'analyticsEvents', docSnap.id));
    deletedCount++;
  }
  console.log(`Documentos apagados: ${deletedCount}`);

  const snapAfter = await getDocs(collection(db, 'analyticsEvents'));
  console.log(`\nTotal analyticsEvents depois: ${snapAfter.size}`);

  process.exit(0);
}

run().catch((err) => {
  console.error('Error during analytics purge:', err);
  process.exit(1);
});
