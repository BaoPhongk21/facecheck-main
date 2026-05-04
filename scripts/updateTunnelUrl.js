const fs = require('fs');
const path = require('path');

const urlFile = path.resolve(__dirname, '..', 'cloudflare_url.txt');
const apiConfig = path.resolve(__dirname, '..', 'mobile', 'src', 'config', 'api.js');

if (!fs.existsSync(urlFile)) {
  console.error('URL file not found:', urlFile);
  process.exit(1);
}

const content = fs.readFileSync(urlFile, 'utf8');
const match = content.match(/https:\/\/[^\s]+trycloudflare\.com/);
if (!match) {
  console.error('Could not find Cloudflare URL in file');
  process.exit(1);
}
const newUrl = match[0];

let apiContent = fs.readFileSync(apiConfig, 'utf8');
apiContent = apiContent.replace(/export const BACKEND_URL = `.*`;/, `export const BACKEND_URL = \`${newUrl}\`;`);
fs.writeFileSync(apiConfig, apiContent, 'utf8');
console.log('Updated BACKEND_URL to', newUrl);
