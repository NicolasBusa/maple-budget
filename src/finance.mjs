export const DAY = 86400000;
export function date(s) {
  const d = new Date(s + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(+d) ||
    d.toISOString().slice(0, 10) !== s
  )
    throw Error("Data inválida");
  return d;
}
export function addMonths(s, n) {
  const d = date(s),
    t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  t.setUTCDate(
    Math.min(
      d.getUTCDate(),
      new Date(
        Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0),
      ).getUTCDate(),
    ),
  );
  return t.toISOString().slice(0, 10);
}
export const days = (a, b) => Math.round((date(b) - date(a)) / DAY);
export const periods = (start) =>
  [0, 1, 2].map((i) => ({
    start: addMonths(start, i),
    end: addMonths(start, i + 1),
  }));
export function moneyInput(s) {
  const normalized = String(s).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw Error("Use um valor positivo com até duas casas decimais.");
  const n = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(n) || n > 1e10)
    throw Error("Valor fora do limite.");
  return n;
}
export const cad = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "CAD" }).format(
    n / 100,
  );
export const brl = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n / 100,
  );
export const total = (xs) => xs.reduce((n, x) => n + x.amount, 0);
export const between = (xs, a, b) =>
  xs.filter((x) => x.date >= a && x.date < b);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const shortDate = (s) =>
  date(s).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  });
export function project(trip, categories, expenses, now = today(), factor = 1) {
  const ps = periods(trip.start),
    end = ps[2].end,
    actual = between(expenses, trip.start, end),
    spent = total(actual);
  const limits = ps.map((p, i) =>
    categories.reduce((s, c) => s + Math.round(c.limits[i] * factor), 0),
  );
  const remaining = ps.reduce(
    (s, p, i) =>
      s +
      (p.end <= now
        ? 0
        : categories.reduce(
            (n, c) =>
              n +
              Math.max(
                0,
                Math.round(c.limits[i] * factor) -
                  total(
                    between(actual, p.start, p.end).filter(
                      (e) => e.categoryId === c.id,
                    ),
                  ),
              ),
            0,
          )),
    0,
  );
  const completed = Math.max(
    0,
    Math.min(days(trip.start, end), days(trip.start, now)),
  );
  const pace = completed
    ? trip.budget -
      Math.round(
        (total(between(actual, trip.start, now < end ? now : end)) /
          completed) *
          days(trip.start, end),
      )
    : null;
  return {
    spent,
    balance: trip.budget - spent,
    plannedReturn: trip.budget - spent - remaining,
    fullPlanReturn: trip.budget - limits.reduce((a, b) => a + b, 0),
    pace,
    limits,
    remaining,
  };
}
export const defaults = () => ({
  trip: { city: "Toronto", start: "2026-12-07", budget: 632800, goal: 152800 },
  categories: [
    ["Alimentação", 650, "#15765c", "Utensils"],
    ["Academia", 80, "#8562bf", "Dumbbell"],
    ["Passeios", 250, "#d68a37", "Compass"],
    ["Transporte", 180, "#4c84b0", "TrainFront"],
    ["Celular/internet", 60, "#4b9d9c", "Smartphone"],
    ["Compras", 250, "#bf6882", "ShoppingBag"],
    ["Imprevistos", 130, "#83936d", "ShieldCheck"],
  ].map(([name, limit, color, icon], i) => ({
    id: "category-" + i,
    name,
    limits: [limit * 100, limit * 100, limit * 100],
    color,
    icon,
  })),
  expenses: [],
  recurring: [],
});
export function parseReceipt(text, categories) {
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  const amounts = (line) =>
    [...line.matchAll(/(?:\$\s*)?(\d+(?:,\d{3})*\.\d{2}|\d+,\d{2})\b/g)].map(
      (m) => moneyInput(m[1].includes(".") ? m[1].replaceAll(",", "") : m[1]),
    );
  const totals = lines
    .filter(
      (l) =>
        /\b(grand\s*total|total|amount\s*due|balance\s*due)\b/i.test(l) &&
        !/(sub\s*total|tax|saving|discount|items)/i.test(l),
    )
    .map((l) => amounts(l).at(-1))
    .filter((n) => n > 0);
  const amount = totals.at(-1) || 0;
  const rules = [
    [
      /grocery|food|market|loblaws|metro|walmart|restaurant|cafe|coffee|tim hortons|pizza|sobeys|no frills/i,
      "Alimentação",
    ],
    [/fitness|gym|fit4less|goodlife|planet fitness/i, "Academia"],
    [/ttc|presto|uber|lyft|transit|go transit/i, "Transporte"],
    [/mobile|fido|rogers|bell|koodo|freedom|chatr/i, "Celular/internet"],
    [/museum|ticket|aquarium|cn tower|cinema/i, "Passeios"],
  ];
  const category = categories.find((c) =>
    rules.some(([re, name]) => name === c.name && re.test(text)),
  );
  const iso = text.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/);
  let receiptDate = "";
  try {
    if (iso) {
      receiptDate = iso[1] + "-" + iso[2] + "-" + iso[3];
      date(receiptDate);
    }
  } catch {
    receiptDate = "";
  }
  return {
    amount,
    description: lines[0]?.slice(0, 100) || "",
    categoryId: category?.id || "",
    date: receiptDate,
    needsReview: true,
  };
}
