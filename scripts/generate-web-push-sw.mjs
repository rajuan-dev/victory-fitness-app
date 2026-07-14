import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const env = {};

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)\s*$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
}

const value = (name) => process.env[name] || env[name] || '';
const replacements = {
  __FIREBASE_API_KEY__: value('EXPO_PUBLIC_FIREBASE_API_KEY'),
  __FIREBASE_PROJECT_ID__: value('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  __FIREBASE_MESSAGING_SENDER_ID__: value('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  __FIREBASE_APP_ID__: value('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

if (Object.values(replacements).some((item) => !item)) {
  throw new Error('Missing Firebase web push environment variables.');
}

let serviceWorker = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
for (const [placeholder, replacement] of Object.entries(replacements)) {
  serviceWorker = serviceWorker.replaceAll(placeholder, replacement.replaceAll('\\', '\\\\').replaceAll("'", "\\'"));
}

fs.writeFileSync(path.join(root, 'dist', 'sw.js'), serviceWorker);
console.log('Generated dist/sw.js from environment configuration.');
