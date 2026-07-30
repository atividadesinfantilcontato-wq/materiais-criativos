// Client-side helper to upload image to Cloudflare R2 via server endpoint
export async function uploadToR2(file: File, folder: string = 'materials'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await fetch('/api/upload-r2', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (response.ok && data.url) {
    if (data.url.startsWith('data:image') || data.url.startsWith('blob:')) {
      throw new Error('O servidor R2 retornou um formato de dados inválido (base64/data URL). Configure as chaves de acesso do Cloudflare R2.');
    }
    return data.url;
  }

  const errorMessage = data.error || data.warning || 'Erro desconhecido ao enviar imagem para o Cloudflare R2.';
  console.error('Erro no upload R2:', errorMessage);
  throw new Error(errorMessage);
}

