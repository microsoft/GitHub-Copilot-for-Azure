const fs = require('fs');
const path = require('path');

const publicDir = 'public';

// Create public directory
fs.mkdirSync(publicDir, { recursive: true });

// Copy static files
const extensions = ['.html', '.css', '.js', '.json', '.ico', '.png', '.jpg', '.svg'];
fs.readdirSync('.')
  .filter(f => extensions.some(ext => f.endsWith(ext)) && f !== 'package.json')
  .forEach(f => {
    fs.copyFileSync(f, path.join(publicDir, f));
    console.log(`Copied ${f} -> ${publicDir}/${f}`);
  });

console.log('Build complete');
