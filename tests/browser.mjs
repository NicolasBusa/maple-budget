import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5182"],
  { stdio: "pipe" },
);
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => {
    if (String(d).includes("Local:")) resolve();
  });
  server.on("error", reject);
});
let browser;
const password =
  process.env.MAPLE_QA_PASSWORD ||
  JSON.parse(fs.readFileSync("../qa-credentials.json")).password;
const qaEmail = process.env.MAPLE_QA_EMAIL || "maple-qa-a@example.invalid";
try {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5182");
  await page.getByLabel("E-mail", { exact: true }).fill(qaEmail);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("heading", { name: "Olá, viajante." }).waitFor();
  console.log("PASS browser real login");
  await page.getByRole("button", { name: "Novo gasto", exact: true }).click();
  await page.getByLabel("Valor em dólar canadense").fill("25,20");
  await page.getByLabel("Descrição", { exact: true }).fill("Mercado QA");
  await page
    .getByLabel("Categoria", { exact: true })
    .selectOption("category-0");
  await page.getByRole("button", { name: "Salvar gasto" }).click();
  await page.getByText("Gasto salvo.", { exact: true }).waitFor();
  await page.waitForFunction(() =>
    Object.entries(localStorage).some(
      ([k, v]) =>
        k.startsWith("maple-v1-") &&
        k !== "maple-v1-demo" &&
        JSON.parse(v).pending === false,
    ),
  );
  await page.reload();
  await page.getByText("Mercado QA", { exact: true }).waitFor();
  console.log("PASS expense persisted after reload");
  await ctx.setOffline(true);
  await page.getByRole("button", { name: "Novo gasto", exact: true }).click();
  await page.getByLabel("Valor em dólar canadense").fill("10");
  await page.getByLabel("Descrição", { exact: true }).fill("Offline QA");
  await page
    .getByLabel("Categoria", { exact: true })
    .selectOption("category-2");
  await page.getByRole("button", { name: "Salvar gasto" }).click();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find(
              (k) => k.startsWith("maple-v1-") && k !== "maple-v1-demo",
            ),
          ),
        ).pending,
    ),
    true,
  );
  await ctx.setOffline(false);
  await page.waitForFunction(
    () =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find(
            (k) => k.startsWith("maple-v1-") && k !== "maple-v1-demo",
          ),
        ),
      ).pending === false,
  );
  console.log("PASS offline queue synced");
  await page.getByRole("button", { name: "Plano", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar categoria" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Lavanderia");
  for (let i = 1; i <= 3; i++)
    await page.getByLabel("Limite do mês " + i + " · CAD").fill("30");
  await page.getByRole("button", { name: "Salvar limites" }).click();
  await page.getByRole("button", { name: /Lavanderia/ }).waitFor();
  console.log("PASS custom category");
  await page.getByRole("button", { name: "Economia", exact: true }).click();
  await page.getByLabel("Percentual do plano").fill("80");
  await page.getByText("80% do plano").waitFor();
  console.log("PASS savings simulation");
  await page.getByRole("button", { name: "Câmbio", exact: true }).click();
  await page.getByLabel("Cotação manual BRL por CAD").fill("4");
  await page.getByRole("button", { name: "Usar taxa" }).click();
  await page.getByLabel("Adicionar HST").check();
  await page.getByLabel("Gorjeta (%)").fill("10");
  assert.ok(
    (await page.locator(".conversion-card").innerText()).includes("492,00"),
  );
  console.log("PASS conversion with HST and tip");
  await page.getByRole("button", { name: "Resumo", exact: true }).click();
  await page.screenshot({
    path: "../../outputs/maple-iphone-com-gastos.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  const receipt = await ctx.newPage();
  await receipt.setViewportSize({ width: 700, height: 700 });
  await receipt.setContent(
    "<style>body{margin:30px;background:white;color:black;font:32px monospace}p{margin:25px 0}</style><h1>NO FRILLS</h1><p>2026-12-08</p><p>GROCERIES 24.00</p><p>SUBTOTAL 24.00</p><p>TAX 1.20</p><p>TOTAL $25.20</p><p>CASH 30.00</p><p>CHANGE 4.80</p>",
  );
  fs.mkdirSync("test-results", { recursive: true });
  await receipt.screenshot({ path: "test-results/receipt.png" });
  await receipt.close();
  await page
    .locator("input[type=file][capture]")
    .setInputFiles("test-results/receipt.png");
  await page
    .getByText("Confira valor, data e categoria antes de salvar.", {
      exact: false,
    })
    .waitFor({ timeout: 120000 });
  assert.equal(
    await page.getByLabel("Valor em dólar canadense").inputValue(),
    "25.20",
  );
  assert.equal(
    await page.getByLabel("Categoria", { exact: true }).inputValue(),
    "category-0",
  );
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  console.log("PASS receipt OCR in browser");
  assert.deepEqual(errors, []);
  await browser.close();
  browser = null;
  const wk = await webkit.launch({ headless: true });
  try {
    const p = await wk.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await p.goto("http://127.0.0.1:5182");
    await p.getByText("Explorar demonstração").click();
    await p.getByRole("heading", { name: "Olá, viajante." }).waitFor();
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth),
      390,
    );
    await p.screenshot({
      path: "../../outputs/maple-webkit.png",
      fullPage: false,
    });
    console.log("PASS WebKit mobile rendering");
  } finally {
    await wk.close();
  }
  console.log("ALL UI CHECKS PASSED");
} catch (e) {
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
