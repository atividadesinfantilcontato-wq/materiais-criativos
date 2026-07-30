import busboy from 'busboy';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    if (res.setHeader) res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const bb = busboy({ headers: req.headers });
    let fileBuffer: Buffer | null = null;
    let filename = 'image.png';
    let mimeType = 'image/png';
    let folder = 'materials';

    await new Promise<void>((resolve, reject) => {
      bb.on('file', (_fieldname, fileStream, info) => {
        filename = info.filename;
        mimeType = info.mimeType;
        const chunks: Buffer[] = [];
        fileStream.on('data', (data) => chunks.push(data));
        fileStream.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      bb.on('field', (fieldname, val) => {
        if (fieldname === 'folder') {
          folder = val;
        }
      });

      bb.on('finish', () => resolve());
      bb.on('error', (err) => reject(err));

      req.pipe(bb);
    });

    if (!fileBuffer) {
      return res.status(400).json({ error: 'Nenhum arquivo recebido.' });
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    const r2Client = getR2Client();

    if (!r2Client || !bucketName || !publicUrl) {
      return res.status(400).json({
        error: 'Variáveis de ambiente do Cloudflare R2 não estão configuradas. Verifique CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL.',
      });
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const randomHash = Math.random().toString(36).substring(2, 9);
    const key = `products/${folder}/${Date.now()}-${randomHash}-${cleanFilename}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );

    const formattedPublicUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    const fileUrl = `${formattedPublicUrl}/${key}`;

    return res.status(200).json({ url: fileUrl, key });
  } catch (error: any) {
    console.error('Erro no upload Vercel R2:', error);
    return res.status(500).json({ error: error.message || 'Erro ao processar upload R2.' });
  }
}
