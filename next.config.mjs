import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // next-pwa's auto-register injects via the Pages Router's `_document`,
  // which doesn't exist under the App Router, so it's a no-op here — the
  // service worker is registered manually instead (see
  // app/components/ServiceWorkerRegister.tsx).
  register: false,
  skipWaiting: true,
  // app-build-manifest.json is an internal build artifact under the App
  // Router — it's never served as a public route, so precaching it 404s and
  // fails the entire service worker install. Exclude it from precaching.
  buildExcludes: [/app-build-manifest\.json$/],
})(nextConfig);
