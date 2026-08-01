import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

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
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL || '';
  const r2Client = getR2Client();

  if (!r2Client || !bucketName) {
    return res.status(200).json({
      ok: false,
      error: 'Variáveis do Cloudflare R2 ausentes ou incompletas no servidor.',
      objects: [],
      totalCount: 0,
    });
  }

  const prefixes = ['products/', 'uploads/', 'materials/', 'images/', 'gallery/', 'covers/', 'capas/'];
  const allObjects: Array<{ key: string; size: number; lastModified?: string; publicUrl: string }> = [];

  try {
    const formattedPublicUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;

    for (const prefix of prefixes) {
      let continuationToken: string | undefined = undefined;

      do {
        const listCmd: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const listRes = await r2Client.send(listCmd);
        const contents = listRes.Contents || [];

        for (const item of contents) {
          if (item.Key) {
            allObjects.push({
              key: item.Key,
              size: item.Size || 0,
              lastModified: item.LastModified ? item.LastModified.toISOString() : undefined,
              publicUrl: formattedPublicUrl ? `${formattedPublicUrl}/${item.Key}` : item.Key,
            });
          }
        }

        continuationToken = listRes.NextContinuationToken;
      } while (continuationToken);
    }

    return res.status(200).json({
      ok: true,
      bucketName,
      totalCount: allObjects.length,
      objects: allObjects,
    });
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      error: err?.message || 'Erro ao listar objetos do R2.',
      totalCount: allObjects.length,
      objects: allObjects,
    });
  }
}
