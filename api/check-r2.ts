import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

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
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  const statusVars = {
    CLOUDFLARE_ACCOUNT_ID: accountId ? 'PRESENTE' : 'AUSENTE',
    R2_ACCESS_KEY_ID: accessKeyId ? 'PRESENTE' : 'AUSENTE',
    R2_SECRET_ACCESS_KEY: secretAccessKey ? 'PRESENTE' : 'AUSENTE',
    R2_BUCKET_NAME: bucketName || 'AUSENTE',
    R2_PUBLIC_URL: publicUrl || 'AUSENTE',
  };

  const r2Client = getR2Client();

  if (!r2Client || !bucketName || !publicUrl) {
    return res.status(200).json({
      ok: false,
      statusVars,
      uploadOk: false,
      error: 'Variáveis de ambiente do Cloudflare R2 ausentes ou incompletas no servidor.',
    });
  }

  try {
    const timestamp = Date.now();
    const testKey = `products/connection_test/check-${timestamp}.txt`;
    const testContent = Buffer.from(`R2 Connection Test at ${new Date().toISOString()}`);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain',
      })
    );

    const formattedPublicUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    const generatedUrl = `${formattedPublicUrl}/${testKey}`;

    // Try deleting test object immediately
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: testKey,
        })
      );
    } catch (delErr) {
      console.warn('Non-fatal: delete test object failed', delErr);
    }

    return res.status(200).json({
      ok: true,
      statusVars,
      uploadOk: true,
      generatedUrl,
      testKey,
    });
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      statusVars,
      uploadOk: false,
      error: err?.message || 'Erro durante envio de arquivo teste para o R2.',
    });
  }
}
