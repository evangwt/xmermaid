export interface ExportRequest {
  diagramId: string;
  source: string;
  svg: SVGSVGElement;
  format: 'svg' | 'png';
  fileName?: string;
}

export function encodeShareState(documentText: string, selectedDiagramId: string | null): string {
  return `#xm=${encodeURIComponent(JSON.stringify({ documentText, selectedDiagramId }))}`;
}

export function decodeShareState(hash: string): { documentText: string; selectedDiagramId: string | null } | null {
  const payload = hash.startsWith('#xm=') ? hash.slice(4) : hash.replace(/^#/, '');
  if (!payload) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(payload)) as Partial<{
      documentText: unknown;
      selectedDiagramId: unknown;
    }>;
    if (typeof parsed.documentText !== 'string') return null;
    return {
      documentText: parsed.documentText,
      selectedDiagramId: typeof parsed.selectedDiagramId === 'string' ? parsed.selectedDiagramId : null,
    };
  } catch {
    return null;
  }
}

export async function exportDiagram(request: ExportRequest): Promise<Blob> {
  if (request.format === 'svg') {
    return new Blob([serializeSvg(request.svg)], { type: 'image/svg+xml' });
  }

  return exportPng(request.svg);
}

function serializeSvg(svg: SVGSVGElement): string {
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  return new XMLSerializer().serializeToString(svg);
}

async function exportPng(svg: SVGSVGElement): Promise<Blob> {
  const serialized = serializeSvg(svg);
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to load SVG for PNG export.'));
    });
    image.src = url;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.naturalWidth || Number(svg.getAttribute('width')) || 1);
    canvas.height = Math.max(1, image.naturalHeight || Number(svg.getAttribute('height')) || 1);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable.');
    context.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('PNG export failed.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
