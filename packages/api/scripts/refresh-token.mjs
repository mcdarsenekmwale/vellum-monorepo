import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function refreshToken() {
  const authPath = path.join(os.homedir(), 'Library/Application Support/prisma/auth.json');
  const content = fs.readFileSync(authPath, 'utf-8');
  const data = JSON.parse(content);
  
  if (!data.tokens || data.tokens.length === 0) {
    console.error('No tokens found in auth.json');
    process.exit(1);
  }
  
  const tokenData = data.tokens[0];
  const refreshToken = tokenData.refreshToken;
  
  console.log('Refreshing token...');
  
  try {
    const response = await fetch('https://auth.prisma.io/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'cmm3lndn701oo0uefvxzo0ivw',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Refresh failed: ${response.status} ${response.statusText}`);
      console.error(errorText);
      process.exit(1);
    }
    
    const result = await response.json();
    
    data.tokens[0].token = result.access_token;
    data.tokens[0].refreshToken = result.refresh_token;
    
    fs.writeFileSync(authPath, JSON.stringify(data, null, 2));
    
    const decoded = JSON.parse(Buffer.from(result.access_token.split('.')[1], 'base64').toString());
    console.log(`Token refreshed! Expires: ${new Date(decoded.exp * 1000).toISOString()}`);
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    process.exit(1);
  }
}

refreshToken();
