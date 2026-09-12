import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 [DELIZ BUILD] Starting build process...');

let buildSuccess = false;

try {
  console.log('⚡ [DELIZ BUILD] Executing Vite production build...');
  const viteBin = path.resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
  if (fs.existsSync(viteBin)) {
    execSync(`"${process.execPath}" "${viteBin}" build`, { cwd: rootDir, stdio: 'inherit' });
  } else {
    execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });
  }
  buildSuccess = true;
  console.log('✅ [DELIZ BUILD] Vite build finished cleanly!');
} catch (err) {
  console.error('❌ [DELIZ BUILD ERROR] Vite build failed:', err.message);
  process.exit(1);
}

const distHtml = path.join(rootDir, 'dist', 'index.html');
if (fs.existsSync(distHtml)) {
  console.log('✅ [DELIZ BUILD] Verified production assets in dist/ (index.html present).');
  console.log('🎉 [DELIZ BUILD] Build successfully ready for Render deployment!');
  process.exit(0);
} else {
  console.error('❌ [DELIZ BUILD ERROR] dist/index.html not found.');
  process.exit(1);
}
