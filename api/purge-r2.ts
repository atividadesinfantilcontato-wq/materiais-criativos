import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

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
  // STRICT SECURITY CHECK: Require admin secret key and explicit confirmation key
  const adminSecret = process.env.ADMIN_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const reqSecret = req.headers['x-admin-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  const reqConfirm = req.body?.confirmKey || req.query?.confirmKey;

  if (!adminSecret || reqSecret !== adminSecret || reqConfirm !== 'APAGAR R2') {
    return res.status(401).json({
      ok: false,
      error: 'Acesso negado: Operação destrutiva requer cabeçalho x-admin-secret válido e parâmetro confirmKey="APAGAR R2".',
    });
  }

  const bucketName = process.env.R2_BUCKET_NAME;
  const r2Client = getR2Client();

  if (!r2Client || !bucketName) {
    return res.status(200).json({
      ok: false,
      error: 'Variáveis do Cloudflare R2 ausentes ou incompletas no servidor.',
    });
  }

  const prefixes = ['products/', 'uploads/', 'materials/', 'images/', 'gallery/', 'covers/', 'capas/'];
  let totalBefore = 0;
  let totalDeleted = 0;
  const deletedKeys: string[] = [];
  const logByPrefix: Record<string, number> = {};

  try {
    for (const prefix of prefixes) {
      let continuationToken: string | undefined = undefined;
      let countForPrefix = 0;

      do {
        const listCmd: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const listRes = await r2Client.send(listCmd);
        const contents = listRes.Contents || [];
        countForPrefix += contents.length;
        totalBefore += contents.length;

        if (contents.length > 0) {
          const deleteParams = {
            Bucket: bucketName,
            Delete: {
              Objects: contents.map(item => ({ Key: item.Key! })),
            },
          };

          const delRes = await r2Client.send(new DeleteObjectsCommand(deleteParams));
          const deletedCount = delRes.Deleted?.length || contents.length;
          totalDeleted += deletedCount;
          contents.forEach(item => {
            if (item.Key) deletedKeys.push(item.Key);
          });
        }

        continuationToken = listRes.NextContinuationToken;
      } while (continuationToken);

      logByPrefix[prefix] = countForPrefix;
    }

    return res.status(200).json({
      ok: true,
      bucketName,
      totalBefore,
      totalDeleted,
      totalAfter: totalBefore - totalDeleted,
      logByPrefix,
      deletedKeysSample: deletedKeys.slice(0, 50),
    });
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      error: err?.message || 'Erro durante purga do R2.',
      totalBefore,
      totalDeleted,
    });
  }
}
