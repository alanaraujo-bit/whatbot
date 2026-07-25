/**
 * Gera os ícones PNG do PWA sem depender de bibliotecas de imagem.
 *
 * Desenha um quadrado arredondado verde com um balão de conversa branco,
 * rasteriza em memória e codifica o PNG na mão (zlib + CRC32 nativos do Node).
 * Evita adicionar sharp/canvas ao projeto só para produzir 3 arquivos.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// --------------------------------------------------------------------------
// Codificador PNG mínimo (RGBA, 8 bits, sem entrelaçamento)
// --------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);

  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

/** @param {Uint8Array} rgba pixels RGBA, tamanho = size * size * 4 */
function encodePng(rgba, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidade de bits
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compressão deflate
  ihdr[11] = 0; // filtro padrão
  ihdr[12] = 0; // sem entrelaçamento

  // Cada scanline é precedida por um byte de filtro (0 = None).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------------------------
// Desenho
// --------------------------------------------------------------------------

/** Distância com sinal até um retângulo arredondado centrado na origem. */
function roundedRectDistance(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - (halfW - radius);
  const qy = Math.abs(py) - (halfH - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/**
 * Mistura uma cor sobre o buffer com cobertura `alpha` (antialias).
 * Composição "source-over" simples.
 */
function blend(buffer, index, [r, g, b], alpha) {
  if (alpha <= 0) return;
  const a = Math.min(1, alpha);
  buffer[index] = Math.round(buffer[index] * (1 - a) + r * a);
  buffer[index + 1] = Math.round(buffer[index + 1] * (1 - a) + g * a);
  buffer[index + 2] = Math.round(buffer[index + 2] * (1 - a) + b * a);
  buffer[index + 3] = Math.round(buffer[index + 3] * (1 - a) + 255 * a);
}

const GREEN = [22, 163, 74];
const WHITE = [255, 255, 255];

/**
 * @param {number} size lado do ícone em pixels
 * @param {boolean} maskable quando true, o fundo ocupa 100% e o glifo encolhe
 *   para caber na "safe zone" de 80% exigida por ícones mascaráveis.
 */
function drawIcon(size, maskable) {
  const rgba = new Uint8Array(size * size * 4);
  const center = size / 2;

  // Ícone comum ganha uma margem; mascarável sangra até a borda.
  const bgHalf = maskable ? center : center * 0.94;
  const bgRadius = maskable ? 0 : size * 0.22;

  // Balão: menor no mascarável para sobreviver ao recorte circular do Android.
  const scale = maskable ? 0.5 : 0.62;
  const bubbleHalfW = center * scale;
  const bubbleHalfH = center * scale * 0.86;
  const bubbleRadius = bubbleHalfW * 0.42;
  const bubbleCenterY = -size * 0.02;

  // Rabinho do balão: triângulo com o vértice apontando para baixo-esquerda.
  // Vértices — A (canto superior esquerdo), B (canto superior direito), C (ponta).
  const tailW = bubbleHalfW * 0.34;
  const tailH = bubbleHalfH * 0.5;
  const tailX = -bubbleHalfW * 0.42;
  const tailY = bubbleHalfH + bubbleCenterY;
  const tailBx = tailX + tailW;
  // Comprimento da hipotenusa B→C, para normalizar a distância com sinal.
  const tailHypot = Math.hypot(tailH, tailW * 2);

  // 3 pontinhos de "digitando" dentro do balão.
  const dotRadius = bubbleHalfW * 0.11;
  const dotGap = bubbleHalfW * 0.42;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      // +0.5 amostra no centro do pixel.
      const px = x + 0.5 - center;
      const py = y + 0.5 - center;

      // --- Fundo ---
      const bgDist = maskable
        ? Math.max(Math.abs(px) - bgHalf, Math.abs(py) - bgHalf)
        : roundedRectDistance(px, py, bgHalf, bgHalf, bgRadius);
      blend(rgba, index, GREEN, 0.5 - bgDist);

      // --- Corpo do balão ---
      const bubbleDist = roundedRectDistance(
        px,
        py - bubbleCenterY,
        bubbleHalfW,
        bubbleHalfH,
        bubbleRadius
      );
      let bubbleCoverage = 0.5 - bubbleDist;

      // --- Rabinho ---
      // Interseção de três semiplanos: topo, lateral esquerda e hipotenusa.
      const topEdge = tailY - py;
      const leftEdge = tailX - tailW - px;
      const hypotenuse = ((px - tailBx) * tailH + (py - tailY) * tailW * 2) / tailHypot;
      const triangle = Math.max(topEdge, leftEdge, hypotenuse);
      bubbleCoverage = Math.max(bubbleCoverage, 0.5 - triangle);

      blend(rgba, index, WHITE, bubbleCoverage);

      // --- Pontinhos ---
      for (const offset of [-dotGap, 0, dotGap]) {
        const dotDist = Math.hypot(px - offset, py - bubbleCenterY) - dotRadius;
        blend(rgba, index, GREEN, 0.5 - dotDist);
      }
    }
  }

  return rgba;
}

// --------------------------------------------------------------------------

const outputDir = path.resolve(process.cwd(), "public", "icons");
mkdirSync(outputDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
];

for (const { file, size, maskable } of targets) {
  const png = encodePng(drawIcon(size, maskable), size);
  writeFileSync(path.join(outputDir, file), png);
  console.log(`  ✓ ${file} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

console.log("\nÍcones gerados em public/icons/");
