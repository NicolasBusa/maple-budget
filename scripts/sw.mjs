import fs from "node:fs";
import crypto from "node:crypto";
const assets = fs.readdirSync("dist/assets").map((p) => "/assets/" + p);
const version = crypto
  .createHash("sha256")
  .update(assets.join())
  .digest("hex")
  .slice(0, 12);
fs.writeFileSync(
  "dist/sw.js",
  `const CACHE='maple-${version}';const ASSETS=${JSON.stringify(["/", "/index.html", "/manifest.webmanifest", "/icon.svg", ...assets])};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('maple-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/index.html')));return}e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r})))})`,
);
