const fs = require('fs');

const required = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
];

const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.warn(`[build-config] 未設定の環境変数: ${missing.join(', ')} → firebase-config.js はスキップします`);
  process.exit(0);
}

const content = `window.KANRI_FIREBASE_CONFIG = {
  apiKey: "${process.env.FIREBASE_API_KEY}",
  authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
  projectId: "${process.env.FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET || ''}",
  messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}",
  appId: "${process.env.FIREBASE_APP_ID}"
};
`;

fs.mkdirSync('public/js', { recursive: true });
fs.writeFileSync('public/js/firebase-config.js', content);
console.log('[build-config] public/js/firebase-config.js を生成しました');
