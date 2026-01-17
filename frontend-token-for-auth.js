#!/usr/bin/env node

import crypto from 'crypto';

// Generate HMAC authentication like the frontend does
function generateBackendAuthHeader(payload = '') {
  const secretKey = process.env.VITE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing VITE_SECRET_KEY. Provide it via environment variables.');
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;
  
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');
  
  return `Bearer ${signature}.${timestamp}`;
}

const authHeader = generateBackendAuthHeader();
console.log(authHeader);
