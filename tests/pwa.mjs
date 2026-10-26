import { chromium } from "playwright";
import fs from "node:fs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const base = process.env.MAPLE_TEST_URL || "http://127.0.0.1:5185";
let server;
if (!process.env.MAPLE_TEST_URL) {
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "5185",
    ],
    { stdio: "pipe" },
  );
  await new Promise((r) =>
    server.stdout.on("data", (d) => {
      if (String(d).includes("Local:")) r();
    }),
  );
}
fs.mkdirSync("test-results/downloads", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  downloadsPath: process.cwd() + "/test-results/downloads",
});
try {
  const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    p = await ctx.newPage();
  p.setDefaultTimeout(25000);
  p.on("dialog", (d) => d.accept());
  await p.goto(base);
  await p
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.MAPLE_QA_EMAIL || "maple-qa-a@example.invalid");
  await p
    .getByLabel("Senha", { exact: true })
    .fill(
      process.env.MAPLE_QA_PASSWORD ||
        JSON.parse(fs.readFileSync("../qa-credentials.json")).password,
    );
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.getByRole("heading", { name: "Olá, viajante." }).waitFor();
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.getByRole("heading", { name: "Olá, viajante." }).waitFor();
  assert.ok(await p.evaluate(() => !!navigator.serviceWorker.controller));
  console.log("PASS PWA service worker controls app");
  await ctx.setOffline(true);
  await p.reload();
  await p.getByRole("heading", { name: "Olá, viajante." }).waitFor();
  await p.getByRole("button", { name: "Novo gasto", exact: true }).click();
  await p.getByLabel("Valor em dólar canadense").fill("1.23");
  await p
    .getByLabel("Descrição", { exact: true })
    .fill("PWA offline " + Date.now());
  await p.getByLabel("Categoria", { exact: true }).selectOption("category-0");
  await p.getByRole("button", { name: "Salvar gasto" }).click();
  await p.getByText("Gasto salvo.", { exact: true }).waitFor();
  console.log("PASS offline reload and expense");
  await ctx.setOffline(false);
  await p.waitForFunction(() =>
    Object.entries(localStorage).some(
      ([k, v]) =>
        k.startsWith("maple-v1-") &&
        k !== "maple-v1-demo" &&
        !JSON.parse(v).pending,
    ),
  );
  console.log("PASS queued expense synchronized");
  await p.getByRole("button", { name: "Ajustes", exact: true }).click();
  await p.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      window.__exportBlob = blob;
      return original.call(this, blob);
    };
  });
  await p.getByRole("button", { name: "Exportar backup" }).click();
  const exported = await p.evaluate(() => window.__exportBlob.text());
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/backup.json", exported);
  const saved = JSON.parse(fs.readFileSync("test-results/backup.json", "utf8"));
  assert.equal(saved.trip.budget, 632800);
  await p
    .locator("dialog input[type=file]")
    .setInputFiles("test-results/backup.json");
  await p.getByText("Backup importado.", { exact: true }).waitFor();
  console.log("PASS JSON backup round trip");
  await ctx.setOffline(true);
  await p.reload();
  await p.getByRole("heading", { name: "Olá, viajante." }).waitFor();
  await ctx.setOffline(false);
  await p.waitForFunction(
    () => document.querySelector(".sync-status")?.title === "Salvo na nuvem",
  );
  console.log("PASS reconnect refresh without pending writes");
  const demo = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await demo.goto(base);
  await demo.getByText("Explorar demonstração").click();
  await demo.getByRole("heading", { name: "Olá, viajante." }).waitFor();
  await demo.screenshot({
    path: "../../outputs/maple-preview.png",
    fullPage: false,
  });
  assert.equal(
    await demo.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  console.log("PASS production-sized mobile layout");
  await p.getByRole("button", { name: "Ajustes", exact: true }).click();
  await p.getByRole("button", { name: "Sair da conta", exact: true }).click();
  console.log("PASS sign out");
} finally {
  await browser.close();
  if (server) server.kill();
}
