import fs from "node:fs";
fs.mkdirSync("public/ocr", { recursive: true });
fs.copyFileSync(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/ocr/worker.min.js",
);
for (const name of fs.readdirSync("node_modules/tesseract.js-core"))
  if (name.endsWith(".wasm.js"))
    fs.copyFileSync(
      "node_modules/tesseract.js-core/" + name,
      "public/ocr/" + name,
    );
