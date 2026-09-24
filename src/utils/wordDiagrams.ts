import mermaid from 'mermaid';

// Use the same fenced Mermaid blocks that the Word converter receives.
function mermaidBlocks(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const opening = /^( {0,3})(`{3,}|~{3,})[ \t]*mermaid(?:[ \t].*)?$/.exec(lines[i]);
    if (!opening) continue;
    const indent = opening[1].length;
    const marker = opening[2][0];
    const minLength = opening[2].length;
    const content: string[] = [];
    for (i++; i < lines.length; i++) {
      const closing = /^ {0,3}(`+|~+)[ \t]*$/.exec(lines[i]);
      if (closing && closing[1][0] === marker && closing[1].length >= minLength) break;
      content.push(lines[i].replace(new RegExp(`^ {0,${indent}}`), ''));
    }
    blocks.push(content.join('\n').replace(/\n+$/, ''));
  }
  return blocks;
}

function svgToPng(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = document.documentElement;
    const viewBox = root.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
    if (!viewBox || viewBox.length !== 4 || !viewBox[2] || !viewBox[3]) {
      reject(new Error('Mermaid diagram has no valid dimensions'));
      return;
    }
    root.setAttribute('width', String(viewBox[2]));
    root.setAttribute('height', String(viewBox[3]));
    root.setAttribute('style', (root.getAttribute('style') || '').replace(/max-width:[^;]+;?/g, ''));
    svg = new XMLSerializer().serializeToString(root);
    const image = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      try {
        const width = Math.max(1, image.naturalWidth);
        const height = Math.max(1, image.naturalHeight);
        const scale = Math.min(2, 4000 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to rasterize Mermaid diagram'));
    };
    image.src = url;
  });
}

export async function renderWordDiagrams(markdown: string): Promise<Record<string, string>> {
  const blocks = [...new Set(mermaidBlocks(markdown))];
  const images: Record<string, string> = {};
  if (!blocks.length) return images;

  const wasDark = document.documentElement.classList.contains('dark');
  mermaid.initialize({ startOnLoad: false, theme: 'default', flowchart: { htmlLabels: false } });
  try {
    for (const [index, content] of blocks.entries()) {
      const { svg } = await mermaid.render(`word-export-mermaid-${Date.now()}-${index}`, content);
      images[content] = await svgToPng(svg);
    }
  } finally {
    mermaid.initialize({ theme: wasDark ? 'dark' : 'default' });
  }
  return images;
}
