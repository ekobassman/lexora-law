/**
 * Generate PWA icons from lexora-logo.png
 * Run: npm run generate-icons (or bun run generate-icons)
 * Requires: npm install sharp --save-dev (or bun add -d sharp)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const SRC = path.join(__dirname, '../src/assets/lexora-logo.png');
const OUT = path.join(__dirname, '../public/icons');

if (!fs.existsSync(SRC)) {
  console.warn('Source logo not found at', SRC, '- create icons manually in public/icons/');
  fs.mkdirSync(OUT, { recursive: true });
  process.exit(0);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('sharp not installed. Run: npm install sharp --save-dev');
  fs.mkdirSync(OUT, { recursive: true });
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

Promise.all(
  SIZES.map((size) =>
    sharp(SRC)
      .resize(size, size)
      .png()
      .toFile(path.join(OUT, `icon-${size}x${size}.png`))
  )
).then(() => {
  return Promise.all([
    sharp(SRC).resize(192, 192).png().toFile(path.join(OUT, 'icon-maskable-192.png')),
    sharp(SRC).resize(512, 512).png().toFile(path.join(OUT, 'icon-maskable-512.png')),
  ]);
}).then(() => {
  console.log('PWA icons generated in public/icons/');
}).catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
