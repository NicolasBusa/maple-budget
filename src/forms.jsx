import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  ArrowRight,
  ArrowUpRight,
  LoaderCircle,
  Check,
  Trash2,
  Plus,
  Download,
  LogOut,
  Repeat,
  ArrowLeftRight,
} from "lucide-react";
import { db, download, validate } from "./data";
import {
  cad,
  brl,
  today,
  shortDate,
  addMonths,
  moneyInput,
} from "./finance.mjs";
import { Logo, Button, Field, icons } from "./ui";
export function Auth({ onDemo, recovery, onRecovered }) {
  const [mode, setMode] = useState(recovery ? "update" : "login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let r;
      if (mode === "login")
        r = await db.auth.signInWithPassword({
          email: f.get("email"),
          password: f.get("password"),
        });
      if (mode === "signup")
        r = await db.auth.signUp({
          email: f.get("email"),
          password: f.get("password"),
          options: { emailRedirectTo: location.origin },
        });
      if (mode === "reset")
        r = await db.auth.resetPasswordForEmail(f.get("email"), {
          redirectTo: location.origin,
        });
      if (mode === "update")
        r = await db.auth.updateUser({ password: f.get("password") });
      if (r.error) throw r.error;
      if (mode === "signup")
        setMessage(
          "Conta criada. Confirme seu e-mail, se solicitado, antes de entrar.",
        );
      if (mode === "reset")
        setMessage(
          "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.",
        );
      if (mode === "update") onRecovered();
    } catch (e) {
      setError(
        e.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Logo />
        <div>
          <span className="eyebrow">SEU INTERCÂMBIO, SEU RITMO</span>
          <h1>
            Mais memórias.
            <br />
            Menos contas
            <br />
            na cabeça.
          </h1>
          <p>
            Três meses em Toronto.
            <br />
            Um plano para aproveitar cada um deles.
          </p>
        </div>
        <div className="trip-tag">
          <MapPin size={18} /> TORONTO, CANADÁ <span>07 DEZ — 07 MAR</span>
        </div>
      </div>
      <div className="auth-panel">
        <Logo />
        <div className="auth-box">
          <span className="eyebrow">BEM-VINDO AO MAPLE</span>
          <h2>
            {mode === "signup"
              ? "Sua viagem começa aqui."
              : mode === "reset"
                ? "Vamos recuperar seu acesso."
                : mode === "update"
                  ? "Escolha uma nova senha."
                  : "Seu plano está aqui."}
          </h2>
          <p className="muted">Orçamento, gastos e economia em um só lugar.</p>
          <form onSubmit={submit}>
            {mode !== "update" && (
              <Field
                label="E-mail"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            )}
            {mode !== "reset" && (
              <Field
                label="Senha"
                name="password"
                type="password"
                minLength={8}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            )}
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
            <Button disabled={busy}>
              {busy && <LoaderCircle className="spin" size={18} />}
              {mode === "signup"
                ? "Criar minha conta"
                : mode === "reset"
                  ? "Enviar instruções"
                  : mode === "update"
                    ? "Salvar senha"
                    : "Entrar"}
              <ArrowRight size={18} />
            </Button>
          </form>
          {!recovery && (
            <>
              <button
                className="text-button"
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setMessage("");
                  setError("");
                }}
              >
                {mode === "signup"
                  ? "Já tenho uma conta"
                  : "Criar conta gratuita"}
              </button>
              <button
                className="text-button subtle"
                onClick={() => {
                  setMode(mode === "reset" ? "login" : "reset");
                  setError("");
                  setMessage("");
                }}
              >
                {mode === "reset"
                  ? "Voltar para entrar"
                  : "Esqueci minha senha"}
              </button>
              <div className="divider" />
              <button className="text-button demo-button" onClick={onDemo}>
                Explorar demonstração <ArrowUpRight size={16} />
              </button>
              <p className="small muted">
                Gratuito para uso pessoal. Seus gastos são privados.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export function ExpenseForm({ modal, data, change, close, notify }) {
  const d = modal.draft || {},
    [error, setError] = useState(""),
    [category, setCategory] = useState(d.categoryId || ""),
    [amount, setAmount] = useState(d.amount ? (d.amount / 100).toFixed(2) : ""),
    [description, setDescription] = useState(d.description || ""),
    [when, setWhen] = useState(
      d.date ||
        (today() < data.trip.start || today() >= addMonths(data.trip.start, 3)
          ? data.trip.start
          : today()),
    );
  useEffect(() => {
    const d = modal.draft;
    if (d) {
      setAmount(d.amount ? (d.amount / 100).toFixed(2) : "");
      setCategory(d.categoryId || "");
      setDescription(d.description || "");
      if (d.date) setWhen(d.date);
    }
  }, [modal.draft]);
  function submit(e) {
    e.preventDefault();
    try {
      const n = moneyInput(amount);
      if (n <= 0) throw Error("Informe um valor maior que zero.");
      if (!category) throw Error("Escolha uma categoria.");
      if (when < data.trip.start || when >= addMonths(data.trip.start, 3))
        throw Error(
          "A data deve estar dentro da estadia, até o dia anterior à volta.",
        );
      const item = {
        id: d.id || crypto.randomUUID(),
        amount: n,
        date: when,
        categoryId: category,
        description:
          description.trim() ||
          data.categories.find((c) => c.id === category).name,
        ...(d.recurringId ? { recurringId: d.recurringId } : {}),
      };
      if (
        data.expenses.some(
          (x) =>
            x.id !== item.id &&
            x.amount === item.amount &&
            x.date === item.date &&
            x.description === item.description,
        ) &&
        !confirm("Já existe um gasto igual nesta data. Salvar mesmo assim?")
      )
        return;
      change((s) => ({
        ...s,
        expenses: d.id
          ? s.expenses.map((x) => (x.id === d.id ? item : x))
          : [...s.expenses, item],
      }));
      close();
      notify("Gasto salvo.");
    } catch (e) {
      setError(e.message);
    }
  }
  if (modal.scanning)
    return (
      <div className="empty">
        <LoaderCircle className="spin" size={32} />
        <h3>Lendo sua nota…</h3>
        <p>O reconhecimento acontece neste aparelho.</p>
        <progress max="100" value={modal.progress} />
        <p>{modal.progress}% · A primeira leitura pode demorar um pouco.</p>
      </div>
    );
  return (
    <form onSubmit={submit}>
      {modal.receiptText && (
        <div className="notice">
          <Check size={18} /> Confira valor, data e categoria antes de salvar. A
          foto não é enviada ao banco.
        </div>
      )}
      {modal.scanError && <p className="alert">{modal.scanError}</p>}
      <Field
        label="Valor em dólar canadense"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0,00"
        required
        autoFocus
      />
      <Field
        label="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={100}
        placeholder="Ex.: mercado da semana"
      />
      <Field label="Categoria">
        <select
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Selecione</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Data"
        type="date"
        value={when}
        min={data.trip.start}
        max={new Date(
          new Date(addMonths(data.trip.start, 3) + "T00:00:00Z").getTime() -
            86400000,
        )
          .toISOString()
          .slice(0, 10)}
        onChange={(e) => setWhen(e.target.value)}
        required
      />
      {modal.receiptText && (
        <details>
          <summary>Texto reconhecido</summary>
          <pre className="receipt-text">{modal.receiptText}</pre>
        </details>
      )}
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <Button>
        <Check size={18} />
        Salvar gasto
      </Button>
      {d.id && (
        <Button
          type="button"
          kind="danger"
          onClick={() => {
            if (confirm("Excluir este gasto?")) {
              change((s) => ({
                ...s,
                expenses: s.expenses.filter((x) => x.id !== d.id),
              }));
              close();
              notify("Gasto excluído.");
            }
          }}
        >
          <Trash2 size={17} />
          Excluir gasto
        </Button>
      )}
    </form>
  );
}
export function CategoryForm({ draft, data, change, close, notify }) {
  const [error, setError] = useState("");
  function submit(e) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget),
        name = String(f.get("name")).trim();
      if (!name) throw Error("Informe um nome.");
      if (
        data.categories.some(
          (c) =>
            c.id !== draft?.id && c.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw Error("Já existe uma categoria com esse nome.");
      const item = {
        id: draft?.id || crypto.randomUUID(),
        name,
        icon: f.get("icon"),
        color: f.get("color"),
        limits: [0, 1, 2].map((i) => moneyInput(f.get("limit" + i))),
      };
      change((s) => ({
        ...s,
        categories: draft
          ? s.categories.map((c) => (c.id === draft.id ? item : c))
          : [...s.categories, item],
      }));
      close();
      notify("Categoria salva.");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <form onSubmit={submit}>
      <Field
        label="Nome"
        name="name"
        defaultValue={draft?.name || ""}
        maxLength={60}
        required
      />
      <div className="form-grid">
        <Field label="Ícone">
          <select name="icon" defaultValue={draft?.icon || "Tag"}>
            {Object.keys(icons).map((k, i) => (
              <option key={k} value={k}>
                {
                  [
                    "Alimentação",
                    "Academia",
                    "Passeios",
                    "Transporte",
                    "Celular",
                    "Compras",
                    "Reserva",
                    "Etiqueta",
                  ][i]
                }
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Cor"
          name="color"
          type="color"
          defaultValue={draft?.color || "#15765c"}
        />
      </div>
      {[0, 1, 2].map((i) => (
        <Field
          key={i}
          label={"Limite do mês " + (i + 1) + " · CAD"}
          name={"limit" + i}
          inputMode="decimal"
          defaultValue={((draft?.limits[i] || 0) / 100).toFixed(2)}
          required
        />
      ))}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <Button>Salvar limites</Button>
      {draft && (
        <Button
          kind="danger"
          type="button"
          onClick={() => {
            if (
              data.expenses.some((e) => e.categoryId === draft.id) ||
              data.recurring.some((r) => r.categoryId === draft.id)
            ) {
              setError(
                "Mova os gastos e remova as recorrências antes de excluir esta categoria.",
              );
              return;
            }
            if (data.categories.length === 1) {
              setError("Mantenha pelo menos uma categoria.");
              return;
            }
            if (confirm("Excluir esta categoria?")) {
              change((s) => ({
                ...s,
                categories: s.categories.filter((c) => c.id !== draft.id),
              }));
              close();
            }
          }}
        >
          <Trash2 size={17} />
          Excluir categoria
        </Button>
      )}
    </form>
  );
}
export function SettingsForm({
  data,
  change,
  close,
  notify,
  onExit,
  status,
  demo,
}) {
  const [error, setError] = useState(""),
    fileRef = useRef();
  async function importFile(file) {
    try {
      if (file.size > 2000000) throw Error("Arquivo muito grande.");
      const v = validate(JSON.parse(await file.text()));
      addMonths(v.trip.start, 3);
      if (
        confirm("Substituir os dados pelo backup? Exporte os atuais primeiro.")
      ) {
        change(v);
        notify("Backup importado.");
        close();
      }
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const f = new FormData(e.currentTarget),
              start = f.get("start"),
              end = addMonths(start, 3);
            if (data.expenses.some((x) => x.date < start || x.date >= end))
              throw Error(
                "As novas datas deixariam gastos fora da viagem. Ajuste-os primeiro.",
              );
            const budget = moneyInput(f.get("budget"));
            if (budget <= 0) throw Error("Informe um orçamento positivo.");
            change((s) => ({
              ...s,
              trip: {
                city: String(f.get("city")).trim() || "Toronto",
                start,
                budget,
                goal: moneyInput(f.get("goal")),
              },
            }));
            notify("Viagem atualizada.");
            close();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <Field
          label="Cidade"
          name="city"
          defaultValue={data.trip.city}
          required
          maxLength={60}
        />
        <Field
          label="Chegada (a volta será três meses depois)"
          type="date"
          name="start"
          defaultValue={data.trip.start}
          required
        />
        <Field
          label="Orçamento total · CAD"
          name="budget"
          inputMode="decimal"
          defaultValue={(data.trip.budget / 100).toFixed(2)}
          required
        />
        <Field
          label="Meta de saldo na volta · CAD"
          name="goal"
          inputMode="decimal"
          defaultValue={(data.trip.goal / 100).toFixed(2)}
          required
        />
        {error && <p className="alert">{error}</p>}
        <Button>Salvar ajustes</Button>
      </form>
      <div className="divider" />
      <h3>Seus dados</h3>
      <p className="small muted">
        {status}. O backup em arquivo é uma cópia adicional dos seus registros.
      </p>
      <div className="inline-actions">
        <Button
          kind="secondary"
          onClick={() =>
            download(
              "maple-backup-" + today() + ".json",
              JSON.stringify(data, null, 2),
            )
          }
        >
          <Download size={17} />
          Exportar backup
        </Button>
        <Button kind="secondary" onClick={() => fileRef.current.click()}>
          Importar backup
        </Button>
        <input
          hidden
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
        />
      </div>
      <div className="divider" />
      <h3>No seu iPhone</h3>
      <p className="small muted">
        Abra no Safari, toque em Compartilhar e “Adicionar à Tela de Início”.
        Após o primeiro acesso, as telas e os dados carregados ficam disponíveis
        sem internet. O primeiro download do leitor de notas e a atualização do
        câmbio precisam de conexão.
      </p>
      <Button
        kind="secondary full"
        onClick={() => {
          if (/pendente|salvando|conflito/i.test(status)) {
            setError("Sincronize ou exporte seu backup antes de sair.");
            return;
          }
          onExit();
        }}
      >
        <LogOut size={18} />
        {demo ? "Sair da demonstração" : "Sair da conta"}
      </Button>
    </>
  );
}
export function RecurringForm({ data, change, notify }) {
  const [error, setError] = useState("");
  function submit(e) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget),
        amount = moneyInput(f.get("amount")),
        start = f.get("start");
      if (amount <= 0) throw Error("Informe um valor positivo.");
      if (start < data.trip.start || start >= addMonths(data.trip.start, 1))
        throw Error(
          "A primeira cobrança precisa estar no primeiro mês da viagem.",
        );
      change((s) => ({
        ...s,
        recurring: [
          ...s.recurring,
          {
            id: crypto.randomUUID(),
            description: String(f.get("description")).trim(),
            amount,
            categoryId: f.get("categoryId"),
            start,
          },
        ],
      }));
      e.target.reset();
      notify("Recorrência criada.");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <p className="muted">
        Crie lembretes para academia e celular. Eles aparecem no resumo quando
        vencem. Só entram nos gastos ao registrar o pagamento.
      </p>
      {data.recurring.map((r) => (
        <div className="list-row" key={r.id}>
          <Repeat size={18} />
          <div>
            <strong>{r.description}</strong>
            <small>
              {cad(r.amount)} / mês · desde {shortDate(r.start)}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label={"Remover " + r.description}
            onClick={() => {
              if (
                confirm(
                  "Remover esta recorrência? Os gastos pagos serão preservados.",
                )
              )
                change((s) => ({
                  ...s,
                  recurring: s.recurring.filter((x) => x.id !== r.id),
                }));
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
      <div className="divider" />
      <form onSubmit={submit}>
        <Field label="Descrição" name="description" required maxLength={100} />
        <Field
          label="Valor mensal · CAD"
          name="amount"
          inputMode="decimal"
          required
        />
        <Field label="Categoria">
          <select name="categoryId">
            {data.categories.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Primeira cobrança"
          name="start"
          type="date"
          defaultValue={data.trip.start}
          required
        />
        {error && <p className="alert">{error}</p>}
        <Button>
          <Plus size={18} />
          Adicionar recorrência
        </Button>
      </form>
    </>
  );
}
export function Calculator({
  rate,
  rateError,
  refreshRate,
  setRate,
  onRecord,
}) {
  const [amount, setAmount] = useState("100"),
    [tax, setTax] = useState(false),
    [tip, setTip] = useState("0"),
    [fee, setFee] = useState("0"),
    [manual, setManual] = useState(""),
    [err, setErr] = useState("");
  let base = 0;
  try {
    base = moneyInput(amount);
  } catch {}
  const taxAmount = tax ? Math.round(base * 0.13) : 0,
    tipAmount = Math.round((base * (Number(tip) || 0)) / 100),
    sum = base + taxAmount + tipAmount,
    converted = rate
      ? Math.round(sum * rate.value * (1 + (Number(fee) || 0) / 100))
      : null;
  return (
    <div className="calculator-grid">
      <section className="panel">
        <h2>Simule sua compra</h2>
        <Field
          label="Preço em CAD"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <label className="switch-row">
          <span>
            <strong>Adicionar HST de Ontário · 13%</strong>
            <small>Ative se o preço ainda não inclui o imposto.</small>
          </span>
          <input
            type="checkbox"
            checked={tax}
            onChange={(e) => setTax(e.target.checked)}
          />
        </label>
        <p className="small muted">
          Alguns itens, como alimentos básicos de mercado, têm alíquota zero.
        </p>
        <div className="form-grid">
          <Field
            label="Gorjeta (%)"
            type="number"
            min="0"
            max="100"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
          />
          <Field
            label="Custos cambiais (%)"
            type="number"
            min="0"
            max="100"
            step=".01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
        <p className="small muted">
          Gorjeta sobre o preço sem imposto. Informe os custos de
          conversão/cartão aplicáveis à sua compra.
        </p>
        <div className="calculation-row">
          <span>Preço</span>
          <strong>{cad(base)}</strong>
        </div>
        <div className="calculation-row">
          <span>Imposto + gorjeta</span>
          <strong>{cad(taxAmount + tipAmount)}</strong>
        </div>
        <Button
          onClick={() => {
            try {
              moneyInput(amount);
              if (
                base <= 0 ||
                Number(tip) < 0 ||
                Number(tip) > 100 ||
                Number(fee) < 0 ||
                Number(fee) > 100
              )
                throw Error("Confira valores e percentuais.");
              onRecord(sum);
            } catch (e) {
              setErr(e.message);
            }
          }}
        >
          <Plus size={18} />
          Registrar esta compra
        </Button>
        {err && <p className="alert">{err}</p>}
      </section>
      <div>
        <section className="conversion-card">
          <span className="eyebrow">TOTAL ESTIMADO</span>
          <div className="currency-label">
            Dólar canadense <span>CAD</span>
          </div>
          <h2>{cad(sum)}</h2>
          <div className="conversion-divider">
            <ArrowLeftRight size={22} />
          </div>
          <div className="currency-label">
            Real brasileiro <span>BRL</span>
          </div>
          <h2>{converted !== null ? brl(converted) : "Informe a cotação"}</h2>
          <p>
            {rate
              ? "1 CAD = " +
                rate.value.toFixed(4) +
                " BRL · " +
                (rate.manual ? "taxa manual" : rate.date)
              : "Cotação ainda não disponível."}
          </p>
        </section>
        <section className="panel rate-panel">
          <h3>Sua referência de câmbio</h3>
          <p className="small muted">
            Cotação diária de referência, não a taxa garantida do cartão ou da
            venda dos dólares.
          </p>
          {rateError && <p className="alert small">{rateError}</p>}
          <div className="inline-actions">
            <input
              aria-label="Cotação manual BRL por CAD"
              inputMode="decimal"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="BRL por 1 CAD"
            />
            <Button
              kind="secondary"
              onClick={() => {
                const n = Number(manual.replace(",", "."));
                if (!Number.isFinite(n) || n <= 0 || n > 1000) {
                  setErr("Cotação inválida.");
                  return;
                }
                const v = { value: n, date: today(), manual: true };
                setRate(v);
                localStorage.setItem("maple-rate", JSON.stringify(v));
                setErr("");
              }}
            >
              Usar taxa
            </Button>
          </div>
          <button className="text-link" onClick={refreshRate}>
            Atualizar cotação de referência
          </button>
          <p className="small muted">
            <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">
              Fonte: Frankfurter
            </a>{" "}
            ·{" "}
            <a
              href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html"
              target="_blank"
              rel="noreferrer"
            >
              Sobre o HST
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
