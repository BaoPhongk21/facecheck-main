// scripts/startTunnelAndExpo.js
// This script runs Cloudflare Tunnel, extracts the public URL, updates the mobile API config,
// and then starts the Expo dev server. It works on Windows (PowerShell/Command Prompt).

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Paths
const apiConfigPath = path.resolve(__dirname, '..', 'mobile', 'src', 'config', 'api.js');

// Function to update BACKEND_URL in api.js
function updateBackendUrl(newUrl) {
  let content = fs.readFileSync(apiConfigPath, 'utf8');
  const regex = /export const BACKEND_URL = `.*`;/;
  const replacement = `export const BACKEND_URL = \`${newUrl}\`;`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(apiConfigPath, content, 'utf8');
  console.log('✅ Updated BACKEND_URL in api.js to', newUrl);
}

// Start Cloudflare Tunnel
console.log('🚀 Starting Cloudflare Tunnel...');
const tunnel = spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://localhost:5000'], {
  cwd: process.cwd(),
  shell: true,
});

let urlFound = false;
let buffer = '';

const handleData = (data) => {
  const text = data.toString();
  process.stdout.write(text);
  buffer += text;
  
  if (!urlFound) {
    const match = buffer.match(/https:\/\/[^\s]+trycloudflare\.com/);
    if (match) {
      urlFound = true;
      const publicUrl = match[0];
      console.log('\n\n✨ ĐÃ TÌM THẤY URL CLOUDFLARE:', publicUrl);
      updateBackendUrl(publicUrl);
      startExpo();
    }
  }
};

tunnel.stdout.on('data', handleData);
tunnel.stderr.on('data', handleData);

tunnel.on('close', (code) => {
  console.log(`⚠️ Cloudflare tunnel process exited with code ${code}`);
});

function startExpo() {
  console.log('🚀 Starting Expo dev server...');
  const expo = spawn('npm', ['start'], { cwd: path.resolve(__dirname, '..', 'mobile'), shell: true, stdio: 'inherit' });
  expo.on('close', (code) => {
    console.log(`Expo exited with code ${code}`);
    // When Expo exits, also terminate the tunnel
    tunnel.kill();
  });
}
