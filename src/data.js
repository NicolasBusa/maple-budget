import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config";
export const db = createClient(SUPABASE_URL, SUPABASE_KEY);
export function download(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  return s;
}
