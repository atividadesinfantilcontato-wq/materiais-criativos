// Client-side helper to upload image to Cloudflare R2 via server endpoint (with Data URL fallback)
export async function uploadToR2(file: File, folder: string = 'materials'): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await fetch('/api/upload-r2', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.url) {
      return data.url;
    }
    if (data.error && !data.url) {
      console.warn('Servidor R2 retornou aviso:', data.error);
    }
  } catch (err) {
    console.warn('Falha no envio para R2 server endpoint, usando fallback local:', err);
  }

  // Fallback: read as Data URL locally so upload never fails for the user
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Erro ao ler o arquivo de imagem.'));
      }
    };
    reader.onerror = () => reject(new Error('Falha na leitura do arquivo.'));
    reader.readAsDataURL(file);
  });
}
