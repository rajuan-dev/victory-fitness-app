# Victory Fitness App

## Vercel deployment

This Expo app exports a static web build to `dist/` and includes a minimal web app manifest plus service worker so it can be deployed on Vercel as a PWA shell.

### Required environment variable

Set this in Vercel for the project:

```bash
EXPO_PUBLIC_API_URL=https://your-backend-domain.com
```

Do not leave the default Android emulator URL in production. The deployed web app must point to your hosted backend.

### Local production build

```bash
npm install
npm run build:web
```

### Vercel settings

- Framework preset: `Other`
- Build command: `npm run build:web`
- Output directory: `dist`

The repo also includes `vercel.json`, so Vercel will apply SPA rewrites for Expo Router routes and serve the PWA assets correctly.
