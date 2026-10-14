/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Utilitário de Otimização e Compressão Inteligente de Fotos e Documentos
 * Risel Combustíveis - Sistema de Controle de Frotas & Locações RAC
 * 
 * Previne estouro de memória (Out Of Memory / QuotaExceededError) em dispositivos
 * móveis (iOS Safari / Android Chrome) ao tirar fotos diretamente com a câmera
 * de alta resolução (12MP a 48MP), reduzindo arquivos pesados de 15MB-30MB para
 * ~250KB - 500KB mantendo 100% de nitidez para leitura de CNH e documentos.
 */

export interface OptimizedCnhResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
  isImage: boolean;
  isPdf: boolean;
  dimensions?: { width: number; height: number };
}

/**
 * Converte tamanho em bytes para formato legível (ex: 2.4 MB, 320 KB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Otimiza e comprime uma foto tirada pela câmera do celular ou selecionada da galeria.
 * Se for imagem, redimensiona proporcionalmente para até maxDimension (padrão 1800px)
 * e comprime em JPEG 82% de qualidade.
 * Se for PDF, valida e prepara para envio direto.
 */
export async function optimizeCnhFile(
  file: File,
  driverName?: string,
  options: {
    maxDimension?: number;
    quality?: number;
  } = {}
): Promise<OptimizedCnhResult> {
  const maxDimension = options.maxDimension || 1800;
  const quality = options.quality !== undefined ? options.quality : 0.82;
  const originalSize = file.size;

  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|bmp)$/i.test(file.name);
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  // Nome padronizado para o condutor: CNH - [Nome do Condutor].[ext]
  const cleanDriverName = (driverName || 'Condutor')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ');

  if (!isImage && isPdf) {
    // Processamento de PDF
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const targetFileName = `CNH - ${cleanDriverName}.pdf`;
        const renamedFile = new File([file], targetFileName, { type: 'application/pdf' });
        resolve({
          file: renamedFile,
          blob: file,
          dataUrl,
          previewUrl: '',
          originalSize,
          compressedSize: file.size,
          reductionPercentage: 0,
          isImage: false,
          isPdf: true
        });
      };
      reader.onerror = (err) => reject(new Error('Falha ao processar arquivo PDF: ' + err));
      reader.readAsDataURL(file);
    });
  }

  // Processamento e compressão inteligente de imagem para mobile/desktop
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Se a foto tiver resolução absurda da câmera (ex: 4000x3000), redimensiona proporcionalmente
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // Cria canvas com resolução otimizada
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Não foi possível inicializar renderizador Canvas para otimização de imagem.');
        }

        // Suavização bicúbica de alta qualidade para textos finos da CNH
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Preenche fundo branco (evita transparência preta em PNGs convertidos para JPEG)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Renderiza imagem
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta em JPEG otimizado
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Converte para Blob e File leve
        canvas.toBlob(
          (blob) => {
            // Libera memória do canvas
            canvas.width = 0;
            canvas.height = 0;

            if (!blob) {
              reject(new Error('Falha ao gerar imagem otimizada da CNH.'));
              return;
            }

            const targetFileName = `CNH - ${cleanDriverName}.jpg`;
            const optimizedFile = new File([blob], targetFileName, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });

            const compressedSize = blob.size;
            const reductionPercentage = originalSize > compressedSize
              ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
              : 0;

            resolve({
              file: optimizedFile,
              blob,
              dataUrl,
              previewUrl: dataUrl,
              originalSize,
              compressedSize,
              reductionPercentage,
              isImage: true,
              isPdf: false,
              dimensions: { width, height }
            });
          },
          'image/jpeg',
          quality
        );
      } catch (err: any) {
        console.error('Erro na compressão via Canvas, utilizando fallback seguro:', err);
        // Fallback: se falhar o canvas, lê diretamente sem travar
        const fallbackReader = new FileReader();
        fallbackReader.onload = () => {
          const rawUrl = fallbackReader.result as string;
          resolve({
            file,
            blob: file,
            dataUrl: rawUrl,
            previewUrl: rawUrl,
            originalSize,
            compressedSize: file.size,
            reductionPercentage: 0,
            isImage: true,
            isPdf: false
          });
        };
        fallbackReader.onerror = () => reject(err);
        fallbackReader.readAsDataURL(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível decodificar o arquivo de imagem selecionado.'));
    };

    img.src = objectUrl;
  });
}
