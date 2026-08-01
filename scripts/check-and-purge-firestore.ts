import 'dotenv/config';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'materiais-criativos',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

async function main() {
  console.log('--- FIRESTORE PURGE CHECK ---');
  console.log('Project ID:', firebaseConfig.projectId);

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  const db = getFirestore(app);

  const colRef = collection(db, 'products');
  const snap = await getDocs(colRef);

  console.log('Total products before:', snap.size);
  const deletedIds: string[] = [];
  const deletedTitles: string[] = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    deletedIds.push(docSnap.id);
    deletedTitles.push(data.title || docSnap.id);
    await deleteDoc(doc(db, 'products', docSnap.id));
    console.log(`Apagado doc ID: ${docSnap.id} - ${data.title}`);
  }

  const snapAfter = await getDocs(colRef);
  console.log('Total products after:', snapAfter.size);

  process.exit(0);
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
