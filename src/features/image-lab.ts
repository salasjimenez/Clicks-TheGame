type ImageOutputFormat = 'image/png' | 'image/jpeg' | 'image/webp';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function imageLabMarkup(): string {
  return `<span class="eyebrow">HERRAMIENTA LOCAL</span>
    <h2 id="modal-title">Image Lab</h2>
    <p>Convierte imágenes en PNG, JPG o WebP dentro de este navegador. El archivo no se sube ni se envía a ningún servicio externo.</p>
    <div class="image-lab">
      <label class="image-drop" for="image-source">
        <input id="image-source" type="file" accept="image/*" hidden>
        <span>🖼️</span>
        <strong>Seleccionar imagen</strong>
        <small>Máximo 25 MB · formatos compatibles con tu navegador</small>
      </label>
      <div class="image-preview-shell" id="image-preview-shell" hidden>
        <img id="image-preview" alt="Vista previa de la imagen seleccionada">
        <div><strong id="image-file-name">Sin archivo</strong><small id="image-file-data">0 × 0</small></div>
      </div>
      <div class="format-selector" role="group" aria-label="Formato de salida">
        <button class="format-button is-active" type="button" data-image-format="png">PNG</button>
        <button class="format-button" type="button" data-image-format="jpeg">JPG</button>
        <button class="format-button" type="button" data-image-format="webp">WEBP</button>
      </div>
      <label class="quality-control" for="image-quality">
        <span>Calidad JPG/WebP</span>
        <output id="image-quality-value">92%</output>
        <input id="image-quality" type="range" min="50" max="100" value="92">
      </label>
      <p class="feature-status" id="image-lab-status" aria-live="polite">Selecciona una imagen para comenzar.</p>
    </div>
    <div class="modal-actions">
      <button class="secondary-button" type="button" data-modal-action="close">Cerrar</button>
      <button class="primary-button" type="button" id="image-convert" disabled><span>Convertir y descargar</span></button>
    </div>`;
}

export function mountImageLab(root: HTMLElement): () => void {
  const input = root.querySelector<HTMLInputElement>('#image-source');
  const preview = root.querySelector<HTMLImageElement>('#image-preview');
  const previewShell = root.querySelector<HTMLElement>('#image-preview-shell');
  const fileName = root.querySelector<HTMLElement>('#image-file-name');
  const fileData = root.querySelector<HTMLElement>('#image-file-data');
  const status = root.querySelector<HTMLElement>('#image-lab-status');
  const quality = root.querySelector<HTMLInputElement>('#image-quality');
  const qualityValue = root.querySelector<HTMLOutputElement>('#image-quality-value');
  const convert = root.querySelector<HTMLButtonElement>('#image-convert');
  const formatButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-image-format]')];
  let file: File | null = null;
  let format: ImageOutputFormat = 'image/png';
  let previewUrl = '';
  let disposed = false;

  const setStatus = (text: string, tone: string): void => {
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const revokePreview = (): void => {
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  };

  const onQuality = (): void => {
    if (quality && qualityValue) qualityValue.textContent = `${quality.value}%`;
  };

  const onFormat = (event: Event): void => {
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) return;
    const selected = button.dataset.imageFormat;
    if (selected !== 'png' && selected !== 'jpeg' && selected !== 'webp') return;
    format = `image/${selected}` as ImageOutputFormat;
    formatButtons.forEach((item) => item.classList.toggle('is-active', item === button));
  };

  const onFile = async (): Promise<void> => {
    const selected = input?.files?.[0] ?? null;
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setStatus('El archivo seleccionado no es una imagen compatible.', 'danger');
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setStatus('La imagen supera el límite local de 25 MB.', 'warning');
      return;
    }
    file = selected;
    revokePreview();
    previewUrl = URL.createObjectURL(selected);
    if (!preview || !previewShell) return;
    preview.src = previewUrl;
    try {
      await preview.decode();
      if (disposed) return;
      previewShell.hidden = false;
      if (fileName) fileName.textContent = selected.name;
      if (fileData) fileData.textContent = `${preview.naturalWidth} × ${preview.naturalHeight} · ${formatBytes(selected.size)}`;
      if (convert) convert.disabled = false;
      setStatus('Imagen lista para convertir localmente.', 'success');
    } catch {
      file = null;
      if (convert) convert.disabled = true;
      setStatus('El navegador no pudo leer esta imagen.', 'danger');
    }
  };

  const onConvert = async (): Promise<void> => {
    if (!file || !convert) return;
    convert.disabled = true;
    setStatus('Procesando localmente...', 'info');
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas-context');
      if (format === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const outputQuality = quality ? Number(quality.value) / 100 : 0.92;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('blob')), format, outputQuality);
      });
      const extension = format === 'image/jpeg' ? 'jpg' : format.split('/')[1] ?? 'png';
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'imagen';
      const outputUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = outputUrl;
      link.download = `${baseName}.${extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(outputUrl), 0);
      setStatus(`Conversión completada: ${extension.toUpperCase()} · ${formatBytes(blob.size)}.`, 'success');
    } catch {
      setStatus('No fue posible convertir esta imagen en el navegador.', 'danger');
    } finally {
      if (!disposed) convert.disabled = !file;
    }
  };

  input?.addEventListener('change', onFile);
  quality?.addEventListener('input', onQuality);
  formatButtons.forEach((button) => button.addEventListener('click', onFormat));
  convert?.addEventListener('click', onConvert);

  return () => {
    disposed = true;
    revokePreview();
    input?.removeEventListener('change', onFile);
    quality?.removeEventListener('input', onQuality);
    formatButtons.forEach((button) => button.removeEventListener('click', onFormat));
    convert?.removeEventListener('click', onConvert);
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
