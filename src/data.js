import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config";
import { date, addMonths } from "./finance.mjs";
export const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    fetch: (input, init = {}) =>
      fetch(input, {
        ...init,
        signal: init.signal || AbortSignal.timeout(15000),
      }),
  },
});
export function download(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function validate(s) {
  if (
    !s?.trip ||
    !Array.isArray(s.categories) ||
    !Array.isArray(s.expenses) ||
    !Array.isArray(s.recurring)
  )
    throw Error("Backup inválido.");
  if (
    !Number.isSafeInteger(s.trip.budget) ||
    s.trip.budget <= 0 ||
    !Number.isSafeInteger(s.trip.goal) ||
    s.trip.goal < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.trip.start)
  )
    throw Error("Viagem inválida.");
  if (
    s.categories.length < 1 ||
    s.categories.length > 100 ||
    s.expenses.length > 10000
  )
    throw Error("Quantidade de registros inválida.");
  const ids = new Set(s.categories.map((c) => c.id));
  if (ids.size !== s.categories.length) throw Error("Categorias duplicadas.");
  s.categories.forEach((c) => {
    if (
      !c.name ||
      c.name.length > 60 ||
      !/^#[\da-f]{6}$/i.test(c.color) ||
      c.limits?.length !== 3 ||
      c.limits.some((x) => !Number.isSafeInteger(x) || x < 0)
    )
      throw Error("Categoria inválida.");
  });
  s.expenses.forEach((e) => {
    if (
      !e.id ||
      !ids.has(e.categoryId) ||
      !Number.isSafeInteger(e.amount) ||
      e.amount <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
      typeof e.description !== "string"
    )
      throw Error("Gasto inválido.");
  });
  date(s.trip.start);
  const end = addMonths(s.trip.start, 3);
  if (
    typeof s.trip.city !== "string" ||
    !s.trip.city.trim() ||
    s.trip.city.length > 60
  )
    throw Error("Cidade inválida.");
  const expenseIds = new Set(s.expenses.map((e) => e.id));
  if (expenseIds.size !== s.expenses.length)
    throw Error("Gastos duplicados no backup.");
  s.expenses.forEach((e) => {
    date(e.date);
    if (e.date < s.trip.start || e.date >= end || e.description.length > 100)
      throw Error("Gasto fora da viagem ou descrição inválida.");
  });
  s.recurring.forEach((r) => {
    date(r.start);
    if (
      !r.id ||
      !ids.has(r.categoryId) ||
      !Number.isSafeInteger(r.amount) ||
      r.amount <= 0 ||
      typeof r.description !== "string" ||
      r.start < s.trip.start ||
      r.start >= addMonths(s.trip.start, 1)
    )
      throw Error("Recorrência inválida.");
  });
  return s;
}
