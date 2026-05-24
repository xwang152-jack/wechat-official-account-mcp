import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getVersion(): string {
  const candidates = [
    path.join(__dirname, '../../package.json'),
    path.join(__dirname, '../../../package.json'),
  ];

  for (const candidate of candidates) {
    try {
      const content = readFileSync(candidate, 'utf-8');
      const pkg = JSON.parse(content);
      return pkg.version || '0.0.0';
    } catch {
      continue;
    }
  }
  return '0.0.0';
}
