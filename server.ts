import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createServer as createViteServer } from 'vite';
import trackEventHandler from './api/track-event';
import checkR2Handler from './api/check-r2';
import purgeR2Handler from './api/purge-r2';
import listR2Handler from './api/list-r2';
import purgeAnalyticsHandler from './api/purge-analytics';
import sitemapHandler from './api/sitemap';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  storage: multer.memoryStorage(),
});

// Cloudflare R2 S3 Client Initialization
function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// API Route: Cloudflare R2 Upload
app.post('/api/upload-r2', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const folder = req.body.folder || 'materials';
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    const r2Client = getR2Client();

    if (!r2Client || !bucketName || !publicUrl) {
      return res.status(400).json({
        error: 'Variáveis de ambiente do Cloudflare R2 não estão configuradas. Verifique CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL.',
      });
    }

    const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const randomHash = Math.random().toString(36).substring(2, 9);
    const key = `products/${folder}/${Date.now()}-${randomHash}-${cleanFilename}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    const formattedPublicUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    const fileUrl = `${formattedPublicUrl}/${key}`;

    return res.json({ url: fileUrl, key });
  } catch (error: any) {
    console.error('Erro no upload para o Cloudflare R2:', error);
    return res.status(500).json({ error: error.message || 'Erro ao fazer upload da imagem para o R2.' });
  }
});

// API Route: Track Event (Vercel Geolocation + Firestore)
app.post('/api/track-event', trackEventHandler);

// API Route: Check R2 Connection
app.all('/api/check-r2', checkR2Handler);

// API Route: Purge R2 Objects
app.all('/api/purge-r2', purgeR2Handler);

// API Route: List R2 Objects
app.all('/api/list-r2', listR2Handler);

// API Route: Purge Analytics Events
app.all('/api/purge-analytics', purgeAnalyticsHandler);

// SEO Routes: Sitemap.xml & Robots.txt
app.all('/sitemap.xml', sitemapHandler);
app.all('/api/sitemap', sitemapHandler);

app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end([
    'User-agent: *',
    'Allow: /',
    '',
    'Disallow: /admin',
    'Disallow: /prova-zero',
    'Disallow: /prova-real',
    'Disallow: /check-conexao',
    'Disallow: /versao',
    'Disallow: /api/',
    '',
    'Sitemap: https://www.materiaiscriativos.com.br/sitemap.xml',
    ''
  ].join('\r\n'));
});

// Serve public folder for favicon, manifest, robots.txt, etc.
app.use(express.static(path.join(process.cwd(), 'public')));

// API Route: Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

start();
