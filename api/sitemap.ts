import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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

function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

interface SitemapItem {
  loc: string;
  priority: string;
  changefreq: string;
  lastmod?: string;
}

export default async function sitemapHandler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const baseUrl = 'https://www.materiaiscriativos.com.br';
  const today = new Date().toISOString().split('T')[0];

  const staticRoutes: SitemapItem[] = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily', lastmod: today },
    { loc: `${baseUrl}/materiais`, priority: '0.9', changefreq: 'daily', lastmod: today },
    { loc: `${baseUrl}/categoria/educacao-infantil`, priority: '0.8', changefreq: 'weekly', lastmod: today },
    { loc: `${baseUrl}/categoria/alfabetizacao`, priority: '0.8', changefreq: 'weekly', lastmod: today },
    { loc: `${baseUrl}/categoria/coordenacao-motora`, priority: '0.8', changefreq: 'weekly', lastmod: today },
    { loc: `${baseUrl}/categoria/matematica-infantil`, priority: '0.8', changefreq: 'weekly', lastmod: today },
    { loc: `${baseUrl}/categoria/cores-e-formas`, priority: '0.8', changefreq: 'weekly', lastmod: today },
    { loc: `${baseUrl}/categoria/atividades-com-tampinhas`, priority: '0.8', changefreq: 'weekly', lastmod: today },
  ];

  let dynamicRoutes: SitemapItem[] = [];

  try {
    const db = getFirebaseDb();
    if (db) {
      const q = query(collection(db, 'products'), where('status', '==', 'published'));
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const rawSlug = data.slug || slugify(data.title) || docSnap.id;
        const cleanSlug = String(rawSlug).trim();
        const updatedAt = data.updatedAt ? String(data.updatedAt).split('T')[0] : today;

        if (cleanSlug) {
          dynamicRoutes.push({
            loc: `${baseUrl}/atividade/${cleanSlug}`,
            priority: '0.8',
            changefreq: 'weekly',
            lastmod: updatedAt
          });
        }
      });
    }
  } catch (error) {
    console.error('Erro ao gerar rotas dinamicas no sitemap:', error);
  }

  const allUrls = [...staticRoutes, ...dynamicRoutes];

  const xmlUrls = allUrls.map(item => `  <url>
    <loc>${item.loc}</loc>
    <lastmod>${item.lastmod || today}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join('\n');

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;

  return res.status(200).send(xmlContent);
}
