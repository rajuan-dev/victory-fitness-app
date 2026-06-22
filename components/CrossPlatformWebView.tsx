// TypeScript resolves this barrel for type-checking.
// At runtime, Metro Bundler automatically picks up
// CrossPlatformWebView.web.tsx (web) or
// CrossPlatformWebView.native.tsx (iOS / Android).
export { default } from './CrossPlatformWebView.native';
