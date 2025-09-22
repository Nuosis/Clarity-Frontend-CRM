#!/usr/bin/env node

import crypto from 'crypto';

// Generate HMAC authentication like the frontend does
function generateBackendAuthHeader(payload = '') {
  const secretKey = 'QArxVv0J1xggzd8Ai_Sk7TfFzllOflBJjVxA4kazpDo';
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