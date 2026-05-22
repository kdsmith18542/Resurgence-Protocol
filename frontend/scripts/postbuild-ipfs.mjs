import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const outDir = resolve(process.cwd(), 'out');
const out404 = resolve(outDir, '404.html');
const indexPath = resolve(outDir, 'index.html');

if (!existsSync(out404)) {
  console.log('No out/404.html found, skipping IPFS 404 patch.');
  process.exit(0);
}

const indexContent = readFileSync(indexPath, 'utf-8');

const ipfs404 = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Resurgence Protocol</title>
  <script>
    (function() {
      var path = location.pathname + location.search + location.hash;
      if (path === '/' || path === '') return;
      sessionStorage.setItem('__ipfs_redirect', path);
      location.replace('/');
    })();
  </script>
</head>
<body>
  <noscript>
    <meta http-equiv="refresh" content="0;url=/">
  </noscript>
</body>
</html>
`;

writeFileSync(out404, ipfs404);
console.log('Patched out/404.html for IPFS routing.');

const indexWithHandler = indexContent.replace(
  '<body',
  '<script>var __ipfs_path = sessionStorage.getItem("__ipfs_redirect"); if (__ipfs_path) { sessionStorage.removeItem("__ipfs_redirect"); window.__IPFS_REDIRECT = __ipfs_path; }</script><body'
);
writeFileSync(indexPath, indexWithHandler);
console.log('Patched out/index.html with IPFS redirect handler.');
