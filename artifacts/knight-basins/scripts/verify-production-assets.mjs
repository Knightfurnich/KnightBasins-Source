import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const indexPath = path.resolve(
  process.cwd(),
  process.env.INDEX_HTML_PATH ?? 'dist/public/index.html',
);

let html;
try {
  html = readFileSync(indexPath, 'utf8');
} catch (error) {
  throw new Error(
    `[production-assets] Could not read ${indexPath}: ${error.message}`,
  );
}

const referencedAssets = [
  ...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g),
]
  .map((match) => match[1])
  .filter((assetPath) => /\.(?:css|m?js)(?:[?#].*)?$/.test(assetPath));

if (referencedAssets.length === 0) {
  throw new Error(
    `[production-assets] No JS/CSS assets were found in ${indexPath}.`,
  );
}

const invalidPaths = referencedAssets.filter(
  (assetPath) => !assetPath.startsWith('/assets/'),
);

if (invalidPaths.length > 0) {
  throw new Error(
    `[production-assets] Invalid production asset path(s) in ${indexPath}: ${invalidPaths.join(', ')}. ` +
      'Expected every JS/CSS asset to start with /assets/ and have no other prefix.',
  );
}

if (!referencedAssets.some((assetPath) => /\.(?:m?js)(?:[?#].*)?$/.test(assetPath))) {
  throw new Error(
    `[production-assets] ${indexPath} does not reference a JavaScript asset.`,
  );
}

console.log(
  `[production-assets] OK: ${indexPath} references ${referencedAssets.join(', ')}`,
);