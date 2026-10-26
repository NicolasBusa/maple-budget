import React, { useEffect, useRef, useId } from "react";
import {
  Leaf,
  Tag,
  Utensils,
  Dumbbell,
  Compass,
  TrainFront,
  Smartphone,
  ShoppingBag,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Wallet,
  X,
} from "lucide-react";
import { cad, shortDate, total, days } from "./finance.mjs";
export const icons = {
  Utensils,
  Dumbbell,
  Compass,
  TrainFront,
  Smartphone,
  ShoppingBag,
  ShieldCheck,
  Tag,
};
export function Logo() {
  return (
    <span className="logo">
      <span>
        <Leaf size={23} />
      </span>
      maple<b>.</b>
    </span>
  );
}
export function Button({ children, kind = "", ...props }) {
  return (
    <button className={"button " + kind} {...props}>
      {children}
    </button>
  );
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{label}</span>
      {children ? (
        React.cloneElement(children, { "aria-labelledby": id })
      ) : (
        <input aria-labelledby={id} {...props} />
      )}
    </label>
  );
}
export function CategoryIcon({ category }) {
  const Icon = icons[category?.icon] || Tag;
  return (
    <span
      className="category-icon"
      style={{ color: category?.color, background: category?.color + "15" }}
    >
      <Icon size={20} />
    </span>
  );
}
export function MonthPicker({ month, setMonth, ps }) {
  return (
    <div className="month-picker">
      <button
        aria-label="Mês anterior"
        disabled={month === 0}
        onClick={() => setMonth(month - 1)}
      >
        <ChevronLeft size={17} />
      </button>
      <span>
        Mês {month + 1}
        <small>
          {shortDate(ps[month].start)} — {shortDate(ps[month].end)}
        </small>
      </span>
      <button
        aria-label="Próximo mês"
        disabled={month === 2}
        onClick={() => setMonth(month + 1)}
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
export function Stat({ label, value, detail, icon: Icon }) {
  return (
    <section className="stat">
      <span>
        {label}
        {Icon && <Icon size={17} />}
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}
export function CategoryBars({ categories, expenses, month }) {
  return (
    <div className="category-bars">
      {categories.map((c) => {
        const n = total(expenses.filter((e) => e.categoryId === c.id)),
          limit = c.limits[month];
        return (
          <div className="category-bar" key={c.id}>
            <CategoryIcon category={c} />
            <div>
              <div className="bar-label">
                <strong>{c.name}</strong>
                <span className={n > limit ? "over" : ""}>
                  {cad(n)} <small>/ {cad(limit)}</small>
                </span>
              </div>
              <div className="progress">
                <span
                  style={{
                    width:
                      Math.min(100, limit ? (n / limit) * 100 : n ? 100 : 0) +
                      "%",
                    background: n > limit ? "#b54835" : c.color,
                  }}
                />
              </div>
              {n > limit && (
                <small className="over">
                  Limite excedido em {cad(n - limit)}
                </small>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
export function ExpenseList({ expenses, categories, onEdit }) {
  if (!expenses.length)
    return (
      <div className="empty">
        <span className="round-icon">
          <Wallet size={24} />
        </span>
        <h3>Um começo tranquilo.</h3>
        <p>
          Seus gastos aparecerão aqui.
          <br />
          Adicione o primeiro ou fotografe uma nota.
        </p>
      </div>
    );
  return (
    <div>
      {expenses.map((e) => (
        <button className="expense-row" key={e.id} onClick={() => onEdit(e)}>
          <CategoryIcon
            category={categories.find((c) => c.id === e.categoryId)}
          />
          <span>
            <strong>{e.description}</strong>
            <small>
              {categories.find((c) => c.id === e.categoryId)?.name} ·{" "}
              {shortDate(e.date)}
              {e.recurringId ? " · recorrente" : ""}
            </small>
          </span>
          <strong>{cad(e.amount)}</strong>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  );
}
export function Modal({ title, close, locked, children }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) close();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) close();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          aria-label="Fechar"
          disabled={locked}
          className="icon-button"
          onClick={close}
        >
          <X size={21} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function SpendingChart({ expenses, period, limit, now }) {
  const count = days(period.start, period.end),
    elapsed = Math.max(0, Math.min(count, days(period.start, now) + 1)),
    max = Math.max(limit, total(expenses), 100),
    w = 420,
    left = 42,
    bottom = 185;
  const coords = Array.from({ length: elapsed }, (_, i) => {
      const end = new Date(
        new Date(period.start + "T00:00:00Z").getTime() + (i + 1) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
      return { day: i + 1, value: total(expenses.filter((e) => e.date < end)) };
    }),
    xy = (i, n) =>
      left + ((w - left - 16) * i) / count + "," + (bottom - (167 * n) / max),
    line = coords.map((d) => xy(d.day, d.value)).join(" ");
  return (
    <div className="chart">
      <svg
        viewBox="0 0 420 220"
        role="img"
        aria-label={
          "Gasto acumulado " +
          cad(total(expenses)) +
          ". Limite " +
          cad(limit) +
          "."
        }
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={left}
              x2="404"
              y1={bottom - 167 * f}
              y2={bottom - 167 * f}
              stroke="#e7eae4"
              strokeDasharray="3 4"
            />
            <text x="34" y={bottom - 167 * f + 4} textAnchor="end">
              {Math.round((max * f) / 100)}
            </text>
          </g>
        ))}
        <line
          x1={left}
          y1={bottom}
          x2="404"
          y2={bottom - (167 * limit) / max}
          stroke="#a4b2a3"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        {coords.length > 0 && (
          <>
            <polygon
              points={xy(0, 0) + " " + line + " " + xy(elapsed, 0)}
              fill="#14745b10"
            />
            <polyline
              points={xy(0, 0) + " " + line}
              fill="none"
              stroke="#14745b"
              strokeWidth="3"
            />
          </>
        )}
        <text x={left} y="212">
          Dia 1
        </text>
        <text x="210" y="212" textAnchor="middle">
          Dia {Math.round(count / 2)}
        </text>
        <text x="404" y="212" textAnchor="end">
          Dia {count}
        </text>
      </svg>
      {!expenses.length && (
        <div className="chart-empty">
          <span>Seu próximo capítulo começa aqui.</span>
          <small>Registre um gasto para acompanhar o ritmo.</small>
        </div>
      )}
      <details>
        <summary>Ver valores do gráfico</summary>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Gasto acumulado</th>
            </tr>
          </thead>
          <tbody>
            {coords.map((d) => (
              <tr key={d.day}>
                <td>{d.day}</td>
                <td>{cad(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!coords.length && <p>O período ainda não começou.</p>}
      </details>
    </div>
  );
}
