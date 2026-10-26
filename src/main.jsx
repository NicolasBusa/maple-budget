import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Wallet,
  ChartNoAxesCombined,
  PiggyBank,
  ArrowLeftRight,
  Settings,
  Plus,
  Camera,
  ArrowUpRight,
  ChevronRight,
  Cloud,
  Download,
  Repeat,
  MapPin,
  LoaderCircle,
  Info,
  ShieldCheck,
  Compass,
  Check,
} from "lucide-react";
import {
  cad,
  brl,
  today,
  shortDate,
  periods,
  addMonths,
  days,
  project,
  total,
  between,
  parseReceipt,
} from "./finance.mjs";
import { db, download } from "./data";
import { useAccount } from "./useAccount";
import {
  Logo,
  Button,
  CategoryIcon,
  MonthPicker,
  Stat,
  CategoryBars,
  ExpenseList,
  Modal,
  SpendingChart,
} from "./ui";
import {
  Auth,
  ExpenseForm,
  CategoryForm,
  SettingsForm,
  RecurringForm,
  Calculator,
} from "./forms";
import "./style.css";
const tabs = [
  ["home", "Resumo", LayoutDashboard],
  ["expenses", "Gastos", Wallet],
  ["plan", "Plano", ChartNoAxesCombined],
  ["savings", "Economia", PiggyBank],
  ["calculator", "Câmbio", ArrowLeftRight],
];
function App() {
  const [session, setSession] = useState(undefined),
    [demo, setDemo] = useState(false),
    [recovery, setRecovery] = useState(false);
  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined)
    return (
      <div className="loading">
        <Logo />
        <LoaderCircle className="spin" />
      </div>
    );
  if (recovery) return <Auth recovery onRecovered={() => setRecovery(false)} />;
  if (!session && !demo) return <Auth onDemo={() => setDemo(true)} />;
  return (
    <Dashboard
      key={demo ? "demo" : session.user.id}
      user={session?.user}
      demo={demo}
      onExit={async () => {
        if (demo) setDemo(false);
        else await db.auth.signOut();
      }}
    />
  );
}
function Dashboard({ user, demo, onExit }) {
  const account = useAccount(demo ? "demo" : user.id, demo),
    { data, status, error, change } = account;
  const [tab, setTab] = useState("home"),
    [month, setMonth] = useState(0),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [filter, setFilter] = useState(""),
    [categoryFilter, setCategoryFilter] = useState(""),
    [factor, setFactor] = useState(100),
    [rate, setRate] = useState(null),
    [rateError, setRateError] = useState("");
  const scanRef = useRef(null);
  useEffect(() => {
    const h = () => {
      const value = location.hash.slice(1);
      if (tabs.some((t) => t[0] === value)) setTab(value);
    };
    h();
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("maple-rate"));
      if (r) setRate(r);
    } catch {}
    refreshRate();
  }, []);
  async function refreshRate() {
    setRateError("");
    try {
      const r = await fetch(
        "https://api.frankfurter.dev/v2/rates?base=CAD&quotes=BRL",
        { signal: AbortSignal.timeout(10000) },
      );
      if (!r.ok) throw Error();
      const rows = await r.json();
      if (!Number.isFinite(rows[0]?.rate) || rows[0].rate <= 0) throw Error();
      const value = { value: rows[0].rate, date: rows[0].date, manual: false };
      localStorage.setItem("maple-rate", JSON.stringify(value));
      setRate(value);
    } catch {
      setRateError(
        "Não foi possível atualizar. Use a última cotação ou informe uma taxa manual.",
      );
    }
  }
  function navigate(next) {
    setTab(next);
    location.hash = next;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  if (!data)
    return (
      <div className="loading">
        <Logo />
        <LoaderCircle className="spin" />
        <p>{error || "Carregando seu orçamento…"}</p>
        {error && (
          <Button onClick={() => location.reload()}>Tentar novamente</Button>
        )}
      </div>
    );
  const { trip, categories, expenses, recurring } = data,
    ps = periods(trip.start),
    end = addMonths(trip.start, 3),
    p = ps[month],
    now = today(),
    inMonth = between(expenses, p.start, p.end),
    spentMonth = total(inMonth),
    limit = categories.reduce((s, c) => s + c.limits[month], 0),
    summary = project(trip, categories, expenses, now),
    scenario = project(trip, categories, expenses, now, factor / 100);
  const due = recurring
    .flatMap((r) =>
      ps.map((p, i) => ({
        ...r,
        occurrence: r.id + "-" + i,
        date: addMonths(r.start, i),
      })),
    )
    .filter(
      (r) =>
        r.date >= trip.start &&
        r.date < end &&
        r.date <= now &&
        !expenses.some((e) => e.recurringId === r.occurrence),
    );
  async function scan(file) {
    if (!file) return;
    setModal({ type: "expense", scanning: true, progress: 0 });
    let worker;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw Error("Escolha uma foto de até 20 MB.");
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
        logger: (m) => {
          if (m.status === "recognizing text")
            setModal((v) =>
              v ? { ...v, progress: Math.round(m.progress * 100) } : v,
            );
        },
      });
      const r = await worker.recognize(file);
      setModal({
        type: "expense",
        draft: parseReceipt(r.data.text, categories),
        receiptText: r.data.text,
      });
    } catch (e) {
      setModal({
        type: "expense",
        scanError:
          e.message || "Não foi possível ler a nota. Preencha manualmente.",
      });
    } finally {
      if (worker) await worker.terminate();
      if (scanRef.current) scanRef.current.value = "";
    }
  }
  const openExpense = (e) => setModal({ type: "expense", draft: e });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <span className="sidebar-caption">SUA VIAGEM EM EQUILÍBRIO</span>
        <nav>
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={20} />
              {label}
              {tab === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="destination">
            <span className="flag">CA</span>
            <div>
              <strong>{trip.city}</strong>
              <small>
                {shortDate(trip.start)} — {shortDate(end)}
              </small>
            </div>
          </div>
          <button
            className="settings-link"
            onClick={() => setModal({ type: "settings" })}
          >
            <Settings size={18} /> Ajustes da viagem
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-logo">
            <Logo />
          </div>
          <div className="breadcrumb">
            Meu intercâmbio <ChevronRight size={14} />{" "}
            <strong>{trip.city}</strong>
          </div>
          <div className="top-actions">
            <span className="sync-status" title={status}>
              <Cloud size={16} />
              <span>{demo ? "Demonstração" : status}</span>
            </span>
            <button
              aria-label="Ajustes"
              className="icon-button"
              onClick={() => setModal({ type: "settings" })}
            >
              <Settings size={20} />
            </button>
            <span className="avatar">
              {demo ? "D" : (user?.email?.[0] || "M").toUpperCase()}
            </span>
          </div>
        </header>
        <main>
          {demo && (
            <div className="demo-banner">
              <Info size={16} />
              <span>Demonstração • dados separados da conta</span>
              <button onClick={onExit}>Entrar</button>
            </div>
          )}
          {error && (
            <div className="alert sync-alert">
              <span>{error}</span>
              <button onClick={() => account.retry()}>
                Tentar sincronizar
              </button>
              <button
                onClick={() =>
                  download(
                    "maple-copia-local.json",
                    JSON.stringify(data, null, 2),
                  )
                }
              >
                Exportar cópia
              </button>
              <button
                onClick={async () => {
                  if (
                    confirm(
                      "Carregar a nuvem substituirá os dados locais. Já exportou suas alterações?",
                    )
                  )
                    try {
                      await account.reload();
                    } catch (e) {
                      setToast(e.message);
                    }
                }}
              >
                Carregar nuvem
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {tab === "home"
                  ? "UMA VIAGEM PARA VIVER BEM"
                  : tab === "expenses"
                    ? "CADA GASTO CONTA"
                    : tab === "plan"
                      ? "SEU DINHEIRO, SUAS PRIORIDADES"
                      : tab === "savings"
                        ? "UM POUCO HOJE. MAIS NA VOLTA."
                        : "ANTES DE PASSAR O CARTÃO"}
              </span>
              <h1>
                {tab === "home"
                  ? "Olá, viajante."
                  : tab === "expenses"
                    ? "Seus gastos"
                    : tab === "plan"
                      ? "Plano da viagem"
                      : tab === "savings"
                        ? "Leve a economia de volta."
                        : "Quanto custa em reais?"}
              </h1>
              <p className="muted">
                {tab === "home"
                  ? now < trip.start
                    ? "Toronto está chegando. Seu orçamento já pode estar pronto."
                    : now >= end
                      ? "Sua viagem terminou. Veja o saldo que ficou."
                      : "Acompanhe suas escolhas e aproveite Toronto."
                  : tab === "plan"
                    ? "Defina limites que deixem espaço para as boas experiências."
                    : tab === "savings"
                      ? "Simule seus limites e descubra o saldo previsto ao voltar."
                      : tab === "calculator"
                        ? "Converta CAD para BRL, com os extras da compra."
                        : "Registre, encontre e acompanhe suas despesas."}
              </p>
            </div>
            {["home", "expenses"].includes(tab) && (
              <div className="heading-actions">
                <Button
                  kind="secondary"
                  onClick={() => scanRef.current.click()}
                >
                  <Camera size={18} />
                  Ler nota
                </Button>
                <Button onClick={() => openExpense()}>
                  <Plus size={18} />
                  Novo gasto
                </Button>
              </div>
            )}
          </div>
          <input
            hidden
            ref={scanRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => scan(e.target.files?.[0])}
          />
          {tab === "home" && (
            <>
              <div className="hero-grid">
                <section className="balance-card">
                  <div className="card-top">
                    <span>Saldo da viagem</span>
                    <span className="light-pill">
                      <MapPin size={13} />
                      {trip.city}
                    </span>
                  </div>
                  <div className="hero-amount">{cad(summary.balance)}</div>
                  <p>de {cad(trip.budget)} para os seus 3 meses</p>
                  <div className="hero-progress">
                    <span
                      style={{
                        width:
                          Math.min(100, (summary.spent / trip.budget) * 100) +
                          "%",
                      }}
                    />
                  </div>
                  <div className="hero-bottom">
                    <span>
                      <span className="dot" /> {cad(summary.spent)} utilizados
                    </span>
                    <span>
                      {Math.round((summary.spent / trip.budget) * 100)}% do
                      orçamento
                    </span>
                  </div>
                </section>
                <section className="savings-preview">
                  <span className="round-icon">
                    <PiggyBank size={24} />
                  </span>
                  <span className="eyebrow">SE SEGUIR O PLANO</span>
                  <h2>{cad(summary.plannedReturn)}</h2>
                  <p>podem voltar com você para o Brasil.</p>
                  <button onClick={() => navigate("savings")}>
                    Explorar minha economia <ArrowUpRight size={17} />
                  </button>
                </section>
              </div>
              <div className="month-toolbar">
                <div>
                  <h2>Seu mês, de perto</h2>
                  <p className="small muted">
                    Períodos contados a partir da chegada
                  </p>
                </div>
                <MonthPicker month={month} setMonth={setMonth} ps={ps} />
              </div>
              <div className="stats-grid">
                <Stat
                  label="Gasto neste mês"
                  value={cad(spentMonth)}
                  detail={"de " + cad(limit) + " planejados"}
                  icon={Wallet}
                />
                <Stat
                  label="Disponível no mês"
                  value={cad(limit - spentMonth)}
                  detail={
                    spentMonth > limit
                      ? "O limite foi ultrapassado"
                      : "Espaço para suas próximas escolhas"
                  }
                  icon={ChartNoAxesCombined}
                />
                <Stat
                  label="Referência diária"
                  value={
                    now >= p.end
                      ? "Encerrado"
                      : cad(
                          Math.floor(
                            (limit - spentMonth) /
                              Math.max(
                                1,
                                days(
                                  now > p.start && now < p.end ? now : p.start,
                                  p.end,
                                ),
                              ),
                          ),
                        )
                  }
                  detail="Saldo do período ÷ dias restantes"
                  icon={Compass}
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Por categoria</h2>
                    <button
                      className="text-link"
                      onClick={() => navigate("plan")}
                    >
                      Editar limites <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <CategoryBars
                    categories={categories}
                    expenses={inMonth}
                    month={month}
                  />
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Ritmo de gastos</h2>
                    <span className="small muted">CAD</span>
                  </div>
                  <SpendingChart
                    expenses={inMonth}
                    period={p}
                    limit={limit}
                    now={now}
                  />
                  <div className="chart-note">
                    <span className="dot green" />
                    Gasto acumulado <span className="dot outline" />
                    Referência do plano
                  </div>
                </section>
              </div>
              {due.length > 0 && (
                <section className="panel">
                  <h2>Contas para conferir</h2>
                  {due.map((r) => (
                    <div key={r.occurrence} className="list-row">
                      <Repeat size={18} />
                      <div>
                        <strong>{r.description}</strong>
                        <small>
                          {shortDate(r.date)} · {cad(r.amount)}
                        </small>
                      </div>
                      <Button
                        kind="secondary"
                        onClick={() =>
                          openExpense({
                            ...r,
                            recurringId: r.occurrence,
                            id: undefined,
                          })
                        }
                      >
                        Registrar pagamento
                      </Button>
                    </div>
                  ))}
                </section>
              )}
              <section className="panel">
                <div className="section-heading">
                  <h2>Últimos gastos</h2>
                  <button
                    className="text-link"
                    onClick={() => navigate("expenses")}
                  >
                    Ver todos <ArrowUpRight size={15} />
                  </button>
                </div>
                <ExpenseList
                  expenses={[...expenses]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 4)}
                  categories={categories}
                  onEdit={openExpense}
                />
              </section>
              <p className="footnote">
                <ShieldCheck size={15} /> Hospedagem, curso, passagem e seguro
                já pagos. Este plano cobre seus gastos durante a estadia.
              </p>
            </>
          )}
          {tab === "expenses" && (
            <>
              <section className="panel">
                <div className="filters">
                  <input
                    aria-label="Buscar gasto"
                    placeholder="Buscar descrição"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <select
                    aria-label="Filtrar categoria"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <MonthPicker month={month} setMonth={setMonth} ps={ps} />
                </div>
                <div className="section-heading">
                  <span className="muted">
                    {inMonth.length} gastos no período
                  </span>
                  <strong>{cad(spentMonth)}</strong>
                </div>
                <ExpenseList
                  expenses={inMonth
                    .filter(
                      (e) =>
                        (!categoryFilter || e.categoryId === categoryFilter) &&
                        e.description
                          .toLowerCase()
                          .includes(filter.toLowerCase()),
                    )
                    .sort((a, b) => b.date.localeCompare(a.date))}
                  categories={categories}
                  onEdit={openExpense}
                />
              </section>
              <div className="inline-actions">
                <Button
                  kind="secondary"
                  onClick={() => setModal({ type: "recurring" })}
                >
                  <Repeat size={18} />
                  Despesas recorrentes
                </Button>
                <Button
                  kind="secondary"
                  onClick={() => {
                    const q = (v) => {
                      const raw = String(v);
                      const safe = /^[=+@\-\t\r]/.test(raw)
                        ? String.fromCharCode(39) + raw
                        : raw;
                      return '"' + safe.replaceAll('"', '""') + '"';
                    };
                    const rows = [
                      ["Data", "Descrição", "Categoria", "Valor CAD"],
                      ...expenses.map((e) => [
                        e.date,
                        e.description,
                        categories.find((c) => c.id === e.categoryId)?.name,
                        (e.amount / 100).toFixed(2),
                      ]),
                    ];
                    download(
                      "maple-gastos.csv",
                      "\uFEFF" + rows.map((r) => r.map(q).join(";")).join("\n"),
                      "text/csv;charset=utf-8",
                    );
                  }}
                >
                  <Download size={18} />
                  Exportar CSV
                </Button>
              </div>
            </>
          )}
          {tab === "plan" && (
            <>
              <div className="plan-summary">
                <Stat
                  label="Orçamento total"
                  value={cad(trip.budget)}
                  detail="3 meses · aluguel já pago"
                  icon={Wallet}
                />
                <Stat
                  label="Plano completo"
                  value={cad(summary.limits.reduce((a, b) => a + b, 0))}
                  detail="Limites dos três meses"
                  icon={ChartNoAxesCombined}
                />
                <Stat
                  label="Sobra pelo plano"
                  value={cad(summary.fullPlanReturn)}
                  detail="Antes dos gastos reais"
                  icon={PiggyBank}
                />
              </div>
              {summary.fullPlanReturn < 0 && (
                <p className="alert">
                  O plano ultrapassa o orçamento em{" "}
                  {cad(-summary.fullPlanReturn)}.
                </p>
              )}
              <section className="panel">
                <div className="section-heading">
                  <h2>Limites por categoria</h2>
                  <MonthPicker month={month} setMonth={setMonth} ps={ps} />
                </div>
                <p className="muted small">
                  Toque na categoria para editar os limites de cada mês.
                </p>
                {categories.map((c) => (
                  <button
                    className="category-edit"
                    key={c.id}
                    onClick={() => setModal({ type: "category", draft: c })}
                  >
                    <CategoryIcon category={c} />
                    <span>
                      <strong>{c.name}</strong>
                      <small>
                        {cad(
                          total(inMonth.filter((e) => e.categoryId === c.id)),
                        )}{" "}
                        gastos
                      </small>
                    </span>
                    <strong>{cad(c.limits[month])}</strong>
                    <ChevronRight size={18} />
                  </button>
                ))}
                <Button
                  kind="secondary full"
                  onClick={() => setModal({ type: "category" })}
                >
                  <Plus size={18} />
                  Adicionar categoria
                </Button>
              </section>
              <p className="footnote">
                Valores iniciais são sugestões editáveis, não cotações de
                serviços. Alimentação inclui mercado e refeições fora.
              </p>
            </>
          )}
          {tab === "savings" && (
            <>
              <section className="economy-hero">
                <div>
                  <span className="eyebrow">PREVISÃO DE SALDO NA VOLTA</span>
                  <h2>{cad(scenario.plannedReturn)}</h2>
                  <p>
                    {rate
                      ? brl(Math.round(scenario.plannedReturn * rate.value)) +
                        " pela cotação de referência"
                      : "O valor em reais aparecerá quando a cotação estiver disponível."}
                  </p>
                  <span className="light-pill">
                    <PiggyBank size={15} /> Se seguir os limites simulados
                  </span>
                </div>
                <PiggyBank className="economy-art" size={120} strokeWidth={1} />
              </section>
              <div className="dashboard-grid">
                <section className="panel">
                  <h2>Experimente outro ritmo</h2>
                  <p className="muted">
                    Simule limites menores. A simulação não altera o plano
                    salvo.
                  </p>
                  <div className="range-label">
                    <span>Limites simulados</span>
                    <strong>{factor}% do plano</strong>
                  </div>
                  <input
                    aria-label="Percentual do plano"
                    type="range"
                    min="40"
                    max="120"
                    step="5"
                    value={factor}
                    onChange={(e) => setFactor(Number(e.target.value))}
                  />
                  <div className="range-label small muted">
                    <span>Mais economia</span>
                    <span>Mais liberdade</span>
                  </div>
                  <div className="calculation-row">
                    <span>Limite médio / mês</span>
                    <strong>
                      {cad(
                        Math.round(
                          scenario.limits.reduce((a, b) => a + b, 0) / 3,
                        ),
                      )}
                    </strong>
                  </div>
                  <div className="calculation-row">
                    <span>Gastos registrados</span>
                    <strong>{cad(summary.spent)}</strong>
                  </div>
                  <div className="calculation-row">
                    <span>Futuros pelo cenário</span>
                    <strong>{cad(scenario.remaining)}</strong>
                  </div>
                  <Button kind="secondary full" onClick={() => setFactor(100)}>
                    Voltar ao meu plano
                  </Button>
                </section>
                <section className="panel">
                  <h2>Uma meta para trazer na mala</h2>
                  <div className="goal-amount">{cad(trip.goal)}</div>
                  <div className="progress">
                    <span
                      style={{
                        width:
                          Math.max(
                            0,
                            Math.min(
                              100,
                              (scenario.plannedReturn /
                                Math.max(1, trip.goal)) *
                                100,
                            ),
                          ) + "%",
                      }}
                    />
                  </div>
                  <p className="muted">
                    {scenario.plannedReturn >= trip.goal
                      ? "Neste cenário, sua meta cabe no orçamento."
                      : "Faltam " +
                        cad(trip.goal - scenario.plannedReturn) +
                        " de economia para sua meta."}
                  </p>
                  <button
                    className="text-link"
                    onClick={() => setModal({ type: "settings" })}
                  >
                    Editar minha meta <ArrowUpRight size={15} />
                  </button>
                  <div className="divider" />
                  <h3>Pelo ritmo real de gastos</h3>
                  <strong className="pace-amount">
                    {summary.pace === null
                      ? "Ainda sem projeção"
                      : cad(summary.pace)}
                  </strong>
                  <p className="small muted">
                    Média dos dias completos desde a chegada. Contas pontuais e
                    dias sem registro podem distorcer a estimativa.
                  </p>
                </section>
              </div>
              <p className="footnote">
                Projeção = orçamento − gastos registrados − valores disponíveis
                nos limites dos períodos não encerrados. Não é garantia de saldo
                nem de câmbio.
              </p>
            </>
          )}
          {tab === "calculator" && (
            <Calculator
              rate={rate}
              rateError={rateError}
              refreshRate={refreshRate}
              setRate={setRate}
              onRecord={(amount) => openExpense({ amount })}
            />
          )}
        </main>
        <footer className="desktop-footer">
          <span>maple · Sua viagem em equilíbrio</span>
          <span>
            {shortDate(trip.start)} — {shortDate(end)} · {days(trip.start, end)}{" "}
            dias
          </span>
        </footer>
      </div>
      <nav className="bottom-nav">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => navigate(key)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {modal && (
        <Modal
          title={
            modal.type === "expense"
              ? "Registrar gasto"
              : modal.type === "category"
                ? "Limites da categoria"
                : modal.type === "settings"
                  ? "Ajustes da viagem"
                  : "Despesas recorrentes"
          }
          close={() => setModal(null)}
          locked={modal.scanning}
        >
          {modal.type === "expense" ? (
            <ExpenseForm
              modal={modal}
              data={data}
              change={change}
              close={() => setModal(null)}
              notify={setToast}
            />
          ) : modal.type === "category" ? (
            <CategoryForm
              draft={modal.draft}
              data={data}
              change={change}
              close={() => setModal(null)}
              notify={setToast}
            />
          ) : modal.type === "settings" ? (
            <SettingsForm
              data={data}
              change={change}
              close={() => setModal(null)}
              notify={setToast}
              onExit={onExit}
              status={status}
              demo={demo}
            />
          ) : (
            <RecurringForm data={data} change={change} notify={setToast} />
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
