import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, BookOpen, Briefcase, CalendarDays, Camera, Check,
  CircleDot, Clock3, Dumbbell, Home, ListChecks, Menu, Moon, NotebookPen, Plus, Settings,
  Smile, Sparkles, Trash2, X, ArrowLeft, Sun, AlertCircle
} from "lucide-react";

type Task = { id: string; title: string; due: string; doneAt: string; category: string; priority: string; };
type Entry = { id: string; date: string; start: string; end: string; activity: string; kind: string; };
type State = { photo: string; tasks: Task[]; entries: Entry[]; };

const NAME = "Samu";
const FROM = "Ramu";

// Ramu's notes, shown in list order: the next one on every page load or refresh, and on each new day. Add or edit freely.
export const QUOTES = [
  "You're not alone in anything you do. I'm with you, cheering you on every step of the way. ❤️",
  "One day at a time, one task at a time. You're doing better than you think.",
  "I believe in you, today and every day. Keep going!",
  "Take a deep breath. You've already come so far, and I'm right here with you.",
  "Rest when you need to. Progress isn't only measured in ticks. ❤️",
  "Small steps every day add up to something amazing. I can't wait to celebrate with you.",
  "Whatever today looks like, I'm proud of you for showing up.",
  "Be kind to yourself today. You're working so hard and it shows.",
  "Your future self is going to thank you for today. So am I. ❤️",
  "Don't compare your pace with anyone else's. Your journey is yours, and it's beautiful.",
  "Drink some water, stretch a little, then go tick off that first task!",
  "I'm so proud of the way you keep going. You inspire me every day.",
  "Whatever happens today, you are enough. Keep going at your own pace, Samu.",
  "Remember to smile today. You're doing something incredible.",
  "Every task you finish is a win. Celebrate the small wins. ❤️",
  "When it feels heavy, take a break and come back. I'll be cheering either way.",
  "Focus on today. Tomorrow will take care of itself.",
  "Consistency beats intensity. Just keep showing up.",
  "You don't have to feel ready. You just have to begin, and I'll be cheering the whole way.",
  "Start with the task you've been avoiding. Everything after it feels lighter.",
  "Don't wait for motivation. Start, and it will catch up with you.",
  "Set one goal for today and finish it. That's a really good day.",
  "Be proud of what you've already done. Then add a little more today.",
  "Break the big task into small pieces. Finish the first piece right now.",
  "Phone face down, timer on, one task. Let's do this together.",
  "Sleep is part of the plan. Rest well tonight, Samu. You've earned it. ❤️",
  "Slow days still count. Progress is progress.",
  "One focused hour beats three distracted ones. Give me one good hour today. ❤️",
  "Done is better than perfect. Finish it now, polish it later.",
  "Be patient with yourself. Good habits take repetition, not perfection.",
  "One bad day doesn't undo many good ones. Begin again today. ❤️",
  "Write down what you did today, even the small things. They all count.",
  "A task left behind isn't a failure. It's just tomorrow's first win.",
  "Keep showing up for yourself. That's the whole secret.",
  "I'm proud of every single thing you do, Samu. Let's tick one more today. ❤️"
];

// Ledger activity kinds; Sleep feeds the sleep stats on the dashboard.
const KINDS: Record<string, { color: string; Icon: typeof Home }> = {
  Work: { color: "#8b5cf6", Icon: Briefcase },
  Study: { color: "#3b82f6", Icon: BookOpen },
  Sleep: { color: "#2f4bb5", Icon: Moon },
  Exercise: { color: "#14b88a", Icon: Dumbbell },
  Chores: { color: "#f28c28", Icon: Home },
  Fun: { color: "#e5487f", Icon: Smile },
  Other: { color: "#8b90a0", Icon: CircleDot }
};
const kindOf = (k: string) => KINDS[k] ?? KINDS.Other;
const tint = (c: string) => ({ "--c": c }) as React.CSSProperties;

const PAGES = ["Dashboard", "Tasks", "Ledger", "Settings"];
const PAGE_ICON: Record<string, typeof Home> = { Dashboard: Home, Tasks: ListChecks, Ledger: NotebookPen, Settings };
const pageFromUrl = () => {
  try { const p = decodeURIComponent(location.hash.slice(1)); return PAGES.includes(p) ? p : "Dashboard"; }
  catch { return "Dashboard"; } // malformed link
};

const LISTS = ["tasks", "entries"] as const;
const emptyState: State = { photo: "", tasks: [], entries: [] };

const KEY = "samu-planner-v1";
// Local YYYY-MM-DD; toISOString() would give the UTC date (yesterday in IST before 05:30).
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
// Minutes from start to end; an end before the start runs past midnight (sleep 23:30 → 07:00).
export const duration = (start: string, end: string) => (toMin(end) - toMin(start) + 1440) % 1440;
// Average time of day on a 24h circle, so 23:30 and 00:30 average to 00:00, not 12:00.
export const avgClock = (times: string[]) => {
  if (!times.length) return "";
  let x = 0, y = 0;
  for (const t of times) { const a = toMin(t) / 1440 * 2 * Math.PI; x += Math.cos(a); y += Math.sin(a); }
  return clock(Math.round((Math.atan2(y, x) / (2 * Math.PI) * 1440 + 1440)) % 1440);
};
// Time-of-day blocks for "when you get things done"; Night wraps past midnight.
export const BLOCKS = [["Morning", 5, 12], ["Afternoon", 12, 17], ["Evening", 17, 21], ["Night", 21, 29]] as const;
export const blockOf = (hour: number) => BLOCKS.find(([, a, b]) => (hour < 5 ? hour + 24 : hour) >= a && (hour < 5 ? hour + 24 : hour) < b)![0];

// Which note is showing and on what day; kept apart from planner data so backups stay unchanged.
type QuoteState = { i: number; day: string };
const QUOTE_KEY = "samu-planner-quote";
export const nextQuote = (prev: QuoteState | null, day: string): QuoteState => ({ i: prev ? (prev.i + 1) % QUOTES.length : 0, day });
const readQuote = (): QuoteState | null => {
  try { const q = JSON.parse(localStorage.getItem(QUOTE_KEY) || "null"); return q && Number.isInteger(q.i) && q.i >= 0 && typeof q.day === "string" ? q : null; }
  catch { return null; }
};
export const advanceQuote = (current?: QuoteState): QuoteState => {
  const q = nextQuote(readQuote() ?? current ?? null, ymd(new Date()));
  try { localStorage.setItem(QUOTE_KEY, JSON.stringify(q)); } catch { /* storage blocked */ }
  return q;
};
// Once per page load, so moving between pages inside the app doesn't change the note.
let loadQuote: QuoteState | undefined;

// Field types each item needs for the pages to render; anything else in a store/backup is dropped.
const REQUIRED: Record<typeof LISTS[number], string[]> = {
  tasks: ["id", "title", "due", "doneAt", "category", "priority"],
  entries: ["id", "date", "start", "end", "activity", "kind"]
};
export const normalise = (raw: unknown): State => {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s: State = { ...emptyState, photo: typeof o.photo === "string" && o.photo.startsWith("data:image/") ? o.photo : "" };
  for (const k of LISTS) {
    const v = o[k];
    // Tasks saved before categories/priorities existed get the defaults instead of being dropped.
    if (Array.isArray(v)) (s[k] as unknown[]) = v.map(x => k === "tasks" && x && typeof x === "object" ? { category: "", priority: "Medium", ...x } : x).filter(x => x && typeof x === "object" && REQUIRED[k].every(f => typeof (x as Record<string, unknown>)[f] === "string"));
  }
  return s;
};
// Keep unreadable or partly invalid data aside instead of letting the next save overwrite it.
const keepAside = (raw: string | null) => { try { if (raw) localStorage.setItem(`${KEY}-unreadable`, raw); } catch { /* storage blocked */ } };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const today = () => ymd(new Date());
const readState = (): State => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw);
    const s = normalise(parsed);
    if (LISTS.some(k => s[k].length !== (Array.isArray(parsed?.[k]) ? parsed[k].length : 0))) keepAside(raw);
    return s;
  } catch { keepAside(raw); return emptyState; }
};
const fmtHours = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`;
export const PRIORITIES = ["High", "Medium", "Low"];
const rank = (p: string) => { const i = PRIORITIES.indexOf(p); return i < 0 ? 1 : i; };
const isLate = (t: Task) => !t.doneAt && !!t.due && t.due < today();
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// Shrink a picked photo so it fits comfortably in localStorage.
const readPhoto = (file: File, done: (url: string) => void, fail: () => void) => {
  const url = URL.createObjectURL(file); const img = new Image();
  img.onload = () => {
    const s = Math.min(1, 320 / Math.min(img.width, img.height)); const c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    done(c.toDataURL("image/jpeg", .85));
  };
  img.onerror = () => { URL.revokeObjectURL(url); fail(); };
  img.src = url;
};

export default function App() {
  const [data, setData] = useState<State>(readState);
  const [page, setPage] = useState(pageFromUrl);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [quote, setQuote] = useState(() => (loadQuote ??= advanceQuote()));
  // A phone may resume the app the next morning without reloading; give it the next note on a new day.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState !== "visible" || loadQuote?.day === ymd(new Date())) return;
      loadQuote = advanceQuote(loadQuote); setQuote(loadQuote);
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch { setToast("Couldn't save. Browser storage is full or blocked, so export a backup."); }
  }, [data]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const update = (patch: Partial<State>) => setData(prev => ({ ...prev, ...patch }));
  const notify = (message: string) => setToast(message);
  // Each page gets a browser history entry, so the phone/browser back button moves between pages.
  const go = (name: string) => {
    setMobileNav(false);
    window.scrollTo(0, 0);
    if (name === page) return;
    history.pushState({ app: true }, "", `#${encodeURIComponent(name)}`);
    setPage(name);
  };
  const back = () => history.state?.app ? history.back() : go("Dashboard");
  useEffect(() => {
    const onPop = () => { setPage(pageFromUrl()); setMobileNav(false); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const addTask = (t: Omit<Task, "id" | "doneAt">) => { update({ tasks: [...data.tasks, { ...t, id: uid(), title: t.title.trim(), category: t.category.trim(), doneAt: "" }] }); notify("Task added"); };
  const toggleTask = (id: string) => { const n = new Date(); update({ tasks: data.tasks.map(t => t.id === id ? { ...t, doneAt: t.doneAt ? "" : `${ymd(n)}T${hm(n)}` } : t) }); };
  const deleteTask = (id: string) => update({ tasks: data.tasks.filter(t => t.id !== id) });
  const addEntry = (e: Omit<Entry, "id">) => { update({ entries: [...data.entries, { ...e, id: uid() }] }); notify("Added to your ledger"); };
  const pickPhoto = (file?: File) => { if (file) readPhoto(file, photo => { update({ photo }); notify("Photo updated"); }, () => notify("Couldn't read that photo")); };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "samu-planner-backup.json"; a.click(); URL.revokeObjectURL(url);
  };
  const importData = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(String(reader.result));
        if (!incoming || !Array.isArray(incoming.tasks) || !Array.isArray(incoming.entries)) throw new Error();
        setData(normalise(incoming));
        notify("Backup restored");
      } catch { notify("That file is not a valid app backup"); }
    };
    reader.onerror = () => notify("Couldn't read that file");
    reader.readAsText(file);
  };

  const pending = data.tasks.filter(t => !t.doneAt).length;
  const nav = [
    { label: "Overview", items: ["Dashboard"] },
    { label: "Plan", items: ["Tasks", "Ledger"] },
    { label: "Personalise", items: ["Settings"] }
  ];
  const avatar = <button className="avatar" aria-label="Choose profile photo" title="Choose profile photo" onClick={() => photoRef.current?.click()}>{data.photo ? <img src={data.photo} alt="" /> : NAME[0]}</button>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "show" : ""}`}>
      <div className="profile-mini">{avatar}<div><b>{NAME}</b><small>{pending} to do</small></div><button className="icon-btn close-nav" aria-label="Close menu" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <nav>{nav.map(group => <div className="nav-group" key={group.label}><div className="nav-heading">{group.label}</div>{group.items.map(item => { const Icon = PAGE_ICON[item]; return <button key={item} className={`nav-item ${page === item ? "active" : ""}`} onClick={() => go(item)}><Icon />{item}</button>; })}</div>)}</nav>
      <div className="sidebar-bottom"><p className="tiny muted">Made with love by {FROM}</p></div>
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
    <main className="main">
      <header className="topbar">{page !== "Dashboard" && <button className="icon-btn" aria-label="Back" title="Back" onClick={back}><ArrowLeft size={18} /></button>}<div className="top-actions"><span className="date-chip"><CalendarDays size={15} />{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div></header>
      <div className="content">
        {page === "Dashboard" && <Dashboard data={data} quote={QUOTES[quote.i]} onNavigate={go} onToggle={toggleTask} />}
        {page === "Tasks" && <TasksPage data={data} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} />}
        {page === "Ledger" && <LedgerPage data={data} onAdd={addEntry} onDelete={id => update({ entries: data.entries.filter(e => e.id !== id) })} />}
        {page === "Settings" && <SettingsPage photo={data.photo} onPhoto={() => photoRef.current?.click()} onRemovePhoto={() => update({ photo: "" })} onExport={exportData} onImport={() => fileRef.current?.click()} onReset={() => { if (confirm("Reset all app data in this browser? Export a backup first if you need it.")) { setData(emptyState); notify("App data reset"); } }} />}
      </div>
    </main>
    <nav className="tabbar" aria-label="Quick navigation">
      <button className={page === "Dashboard" ? "on" : ""} onClick={() => go("Dashboard")}><Home />Home</button>
      <button className={page === "Tasks" ? "on" : ""} onClick={() => go("Tasks")}><ListChecks />Tasks</button>
      <button className="fab" aria-label="Add a task" onClick={() => go("Tasks")}><Plus /></button>
      <button className={page === "Ledger" ? "on" : ""} onClick={() => go("Ledger")}><NotebookPen />Ledger</button>
      <button onClick={() => setMobileNav(true)}><Menu />More</button>
    </nav>
    <input ref={fileRef} hidden type="file" accept="application/json" onChange={e => { importData(e.target.files?.[0]); e.target.value = ""; }} />
    <input ref={photoRef} hidden type="file" accept="image/*" data-testid="photo-input" onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
    {toast && <div className="toast"><Check size={16} />{toast}</div>}
  </div>;
}

function PageTitle({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return <div className="page-title"><div><h1>{title}</h1><p className="muted">{desc}</p></div>{action}</div>;
}
const HEART = "M60 104C22 78 8 56 12 37 15 21 31 12 46 17c6 2 11 7 14 13 3-6 8-11 14-13 15-5 31 4 34 20 4 19-10 41-48 67z";
function HeartArt() {
  return <svg className="note-art" viewBox="0 0 120 112" aria-hidden="true">
    <defs>
      <linearGradient id="heart-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff9cc0" /><stop offset=".55" stopColor="#e5487f" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
      <radialGradient id="heart-shine" cx=".32" cy=".28" r=".38"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
    </defs>
    <path d={HEART} fill="url(#heart-fill)" /><path d={HEART} fill="url(#heart-shine)" />
    <path d="M104 4l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#8b5cf6" />
    <path d="M10 70l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" fill="#14b88a" />
    <circle cx="98" cy="90" r="4" fill="#f5b301" />
  </svg>;
}
function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) { return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>; }
function Empty({ text }: { text: string }) { return <div className="empty"><div className="empty-icon"><Sparkles size={19} /></div><p>{text}</p></div>; }
function Bar({ color, Icon, label, sub, pct, value }: { color: string; Icon: typeof Home; label: string; sub?: string; pct: number; value: string }) {
  return <div className="bar-row"><span className="chip soft" style={tint(color)}><Icon /></span><div className="grow"><b>{label}</b>{sub && <small>{sub}</small>}<div className="bar-track"><span style={{ width: `${pct}%`, background: color }} /></div></div><strong>{value}</strong></div>;
}
function TaskRow({ t, onToggle, onDelete }: { t: Task; onToggle: (id: string) => void; onDelete?: (id: string) => void }) {
  const late = isLate(t);
  return <div className="topic-row"><button className={`topic-check ${t.doneAt ? "done" : ""}`} aria-label={t.doneAt ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`} onClick={() => onToggle(t.id)}>{t.doneAt && <Check size={13} />}</button>
    <div className="grow"><b>{t.title}</b><small>{[t.category, t.doneAt ? `Done ${shortDate(t.doneAt.slice(0, 10))}, ${t.doneAt.slice(11)}` : t.due ? `Finish by ${t.due === today() ? "today" : shortDate(t.due)}` : "No end date"].filter(Boolean).join(" · ")}</small></div>
    {!t.doneAt && <span className="status-pill" style={t.priority === "High" ? { background: "#fde8e8", color: "#c53030" } : undefined}>{t.priority}</span>}
    {late && <span className="status-pill">Left behind</span>}
    {onDelete && <button className="icon-btn danger-hover" title="Delete task" onClick={() => onDelete(t.id)}><Trash2 size={16} /></button>}</div>;
}

function Dashboard({ data, quote, onNavigate, onToggle }: { data: State; quote: string; onNavigate: (s: string) => void; onToggle: (id: string) => void }) {
  const t0 = today();
  const doneToday = data.tasks.filter(t => t.doneAt.startsWith(t0)).length;
  const dueToday = data.tasks.filter(t => t.due === t0 || t.doneAt.startsWith(t0));
  const pct = dueToday.length ? Math.round(dueToday.filter(t => t.doneAt).length / dueToday.length * 100) : 0;
  const late = data.tasks.filter(isLate).sort((a, b) => a.due.localeCompare(b.due));
  const done = data.tasks.filter(t => t.doneAt);
  const blocks = BLOCKS.map(([name]) => ({ name, n: done.filter(t => blockOf(Number(t.doneAt.slice(11, 13))) === name).length }));
  const maxBlock = Math.max(1, ...blocks.map(b => b.n));
  const best = done.length ? blocks.reduce((a, b) => b.n > a.n ? b : a).name : "";
  // Last 7 nights logged as Sleep.
  const nights = data.entries.filter(e => e.kind === "Sleep").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const avgSleep = nights.length ? Math.round(nights.reduce((n, e) => n + duration(e.start, e.end), 0) / nights.length) : 0;
  const week = data.entries.filter(e => e.date >= weekStart());
  const byKind = Object.keys(KINDS).map(k => ({ k, mins: week.filter(e => kindOf(e.kind) === KINDS[k]).reduce((n, e) => n + duration(e.start, e.end), 0) })).filter(x => x.mins);
  const maxKind = Math.max(1, ...byKind.map(x => x.mins));
  return <>
    <section className="hello"><div><h1>Hi, <b>{NAME}</b></h1><p>{doneToday ? `${doneToday} done today. Keep going!` : "What's first today?"}</p></div></section>
    <div className="dash-top">
      <section className="personal-note"><div className="note-body"><h2>A little love note</h2><p className="note-text">{quote}</p><p className="note-sign">With love, {FROM}</p><button className="primary" onClick={() => onNavigate("Tasks")}><Plus size={18} /> Add a task</button></div><HeartArt /></section>
      <button className="progress-card" onClick={() => onNavigate("Tasks")}>
        <div className="pc-head"><div><span className="pc-icon"><ListChecks size={18} /></span><b>Today's tasks</b><small>{dueToday.filter(t => t.doneAt).length} of {dueToday.length} done</small></div><div className="pc-big">{pct}<span>%</span></div></div>
        <div className="slider"><span style={{ width: `${pct}%` }} /></div>
        <div className="slider-ends"><small>0%</small><small>100%</small></div>
      </button>
    </div>
    <div className="stats-grid analytics-stats" style={{ marginTop: 18 }}>
      <Stat icon={<Check />} label="Done today" value={`${doneToday}`} sub={`${done.length} done in all`} />
      <Stat icon={<AlertCircle />} label="Left behind" value={`${late.length}`} sub="Past their date" />
      <Stat icon={<Moon />} label="Avg sleep" value={nights.length ? fmtHours(avgSleep) : "–"} sub={`Last ${nights.length || 7} nights`} />
      <Stat icon={<Clock3 />} label="Logged this week" value={fmtHours(week.reduce((n, e) => n + duration(e.start, e.end), 0))} sub="Since Monday" />
    </div>
    <div className="two-col" style={{ marginTop: 18 }}>
      <section className="panel"><div className="panel-head"><div><h2>When you get things done</h2><p className="muted">{best ? `Most productive: ${best}` : "Tick off tasks to see your best time"}</p></div></div>
        {blocks.map(b => <Bar key={b.name} color="#8b5cf6" Icon={b.name === "Night" ? Moon : Sun} label={b.name} pct={b.n / maxBlock * 100} value={`${b.n}`} />)}</section>
      <section className="panel"><div className="panel-head"><div><h2>Sleep</h2><p className="muted">From Sleep entries in your ledger</p></div><button className="text-btn" onClick={() => onNavigate("Ledger")}>Log sleep</button></div>
        {nights.length ? <>
          <div className="snapshot-line"><span>Usual bedtime</span><b>{avgClock(nights.map(e => e.start))}</b></div>
          <div className="snapshot-line"><span>Usual wake-up</span><b>{avgClock(nights.map(e => e.end))}</b></div>
          {nights.map(e => <div className="snapshot-line" key={e.id}><span>{shortDate(e.date)} · {e.start}–{e.end}</span><b>{fmtHours(duration(e.start, e.end))}</b></div>)}
        </> : <Empty text="Add a Sleep entry in the ledger (bedtime to wake-up) to see your sleep here." />}</section>
    </div>
    <section className="panel" style={{ marginTop: 18 }}><div className="panel-head"><div><h2>Where your time went</h2><p className="muted">This week, from your ledger</p></div><button className="text-btn" onClick={() => onNavigate("Ledger")}>Open ledger</button></div>
      {byKind.length ? byKind.map(({ k, mins }) => <Bar key={k} color={KINDS[k].color} Icon={KINDS[k].Icon} label={k} pct={mins / maxKind * 100} value={fmtHours(mins)} />) : <Empty text="Nothing logged this week yet." />}</section>
    <section className="panel" style={{ marginTop: 18 }}><div className="panel-head"><div><h2>Left behind</h2><p className="muted">Not done by their date</p></div></div>
      {late.length ? late.map(t => <TaskRow key={t.id} t={t} onToggle={onToggle} />) : <Empty text="Nothing left behind. Nice!" />}</section>
  </>;
}

function TasksPage({ data, onAdd, onToggle, onDelete }: { data: State; onAdd: (t: Omit<Task, "id" | "doneAt">) => void; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState(""); const [due, setDue] = useState(today()); const [category, setCategory] = useState(""); const [priority, setPriority] = useState("Medium");
  const add = () => { if (!title.trim()) return; onAdd({ title, due, category, priority }); setTitle(""); };
  const categories = [...new Set(data.tasks.map(t => t.category).filter(Boolean))];
  // Undated tasks go last; done tasks newest first.
  const todo = data.tasks.filter(t => !t.doneAt).sort((a, b) => (a.due || "9").localeCompare(b.due || "9") || rank(a.priority) - rank(b.priority));
  const done = data.tasks.filter(t => t.doneAt).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  return <><PageTitle title="Tasks" desc="Write down what you have to do, and tick it off when it's done." />
    <section className="panel form-panel"><div className="form-grid"><div style={{ gridColumn: "span 2" }}><label className="field-label">Task</label><input className="text-input" autoFocus placeholder="What do you have to do?" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} /></div><div><label className="field-label">Finish by</label><input className="text-input" type="date" aria-label="Finish by" value={due} onChange={e => setDue(e.target.value)} /></div><div style={{ gridColumn: "span 2" }}><label className="field-label">Category</label><input className="text-input" list="task-categories" placeholder="e.g. Work, Home, Shopping" value={category} onChange={e => setCategory(e.target.value)} /><datalist id="task-categories">{categories.map(c => <option key={c} value={c} />)}</datalist></div><div><label className="field-label">Priority</label><select className="select-input" aria-label="Priority" value={priority} onChange={e => setPriority(e.target.value)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div></div><button className="primary" disabled={!title.trim()} onClick={add}><Plus size={16} /> Add task</button></section>
    <section className="panel"><div className="panel-head"><div><h2>To do</h2><p className="muted">{todo.length} left</p></div></div>{todo.length ? todo.map(t => <TaskRow key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} />) : <Empty text="All clear. Add your next task above." />}</section>
    <section className="panel" style={{ marginTop: 18 }}><div className="panel-head"><div><h2>Done</h2><p className="muted">{done.length} finished</p></div></div>{done.length ? done.map(t => <TaskRow key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} />) : <Empty text="Ticked-off tasks show up here." />}</section>
  </>;
}

function LedgerPage({ data, onAdd, onDelete }: { data: State; onAdd: (e: Omit<Entry, "id">) => void; onDelete: (id: string) => void }) {
  const [date, setDate] = useState(today()); const [kind, setKind] = useState("Work"); const [activity, setActivity] = useState("");
  const [start, setStart] = useState(hm(new Date())); const [end, setEnd] = useState(hm(new Date()));
  const list = data.entries.filter(e => e.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const sum = list.reduce((n, e) => n + duration(e.start, e.end), 0);
  const ok = !!start && !!end && start !== end;
  return <><PageTitle title="Ledger" desc="Note what you did and when, so you can see where your day goes." />
    <section className="panel form-panel"><div className="form-grid">
      <div><label className="field-label">Date</label><input className="text-input" type="date" aria-label="Date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div><label className="field-label">Kind</label><select className="select-input" aria-label="Kind" value={kind} onChange={e => setKind(e.target.value)}>{Object.keys(KINDS).map(k => <option key={k}>{k}</option>)}</select></div>
      <div><label className="field-label">What did you do?</label><input className="text-input" placeholder={kind === "Sleep" ? "Sleep" : "e.g. Gym, cooking, reading"} value={activity} onChange={e => setActivity(e.target.value)} /></div>
      <div><label className="field-label">{kind === "Sleep" ? "Went to bed" : "From"}</label><input className="text-input" type="time" aria-label="From" value={start} onChange={e => setStart(e.target.value)} /></div>
      <div><label className="field-label">{kind === "Sleep" ? "Woke up" : "To"}</label><input className="text-input" type="time" aria-label="To" value={end} onChange={e => setEnd(e.target.value)} /></div>
    </div><button className="primary" disabled={!ok} onClick={() => { onAdd({ date, kind, start, end, activity: activity.trim() || kind }); setActivity(""); }}><Plus size={16} /> Add to ledger</button></section>
    <div className="log-summary"><div><span className="muted">{date === today() ? "Today" : shortDate(date)}</span><strong>{fmtHours(sum)}</strong></div><div><span className="muted">Entries</span><strong>{list.length}</strong></div></div>
    <section className="panel">{list.length ? list.map(e => { const { color, Icon } = kindOf(e.kind); return <div className="session-row" key={e.id}><span className="chip soft" style={tint(color)}><Icon /></span><div className="grow"><b>{e.activity}</b><small>{e.kind} · {e.start}–{e.end}</small></div><strong>{fmtHours(duration(e.start, e.end))}</strong><button className="icon-btn danger-hover" title="Delete entry" onClick={() => onDelete(e.id)}><Trash2 size={16} /></button></div>; }) : <Empty text="Nothing logged for this day yet." />}</section>
  </>;
}

function SettingsPage({ photo, onPhoto, onRemovePhoto, onExport, onImport, onReset }: { photo: string; onPhoto: () => void; onRemovePhoto: () => void; onExport: () => void; onImport: () => void; onReset: () => void }) {
  return <><PageTitle title="Settings" desc="Your photo, and backing up your data." />
    <section className="panel settings-panel"><h2>Profile photo</h2><div className="backup-actions" style={{ alignItems: "center" }}><span className="avatar" style={{ width: 64, height: 64 }}>{photo ? <img src={photo} alt="Profile photo" /> : NAME[0]}</span><button className="secondary" onClick={onPhoto}><Camera size={17} /> Choose photo</button>{photo && <button className="secondary" onClick={onRemovePhoto}><Trash2 size={17} /> Remove photo</button>}</div></section>
    <section className="panel settings-panel"><h2>Backup & restore</h2><p className="muted">Your data is stored only in this browser. Export a backup before clearing browser data or changing phones.</p><div className="backup-actions"><button className="secondary" onClick={onExport}><ArrowDownToLine size={17} /> Export backup (.json)</button><button className="secondary" onClick={onImport}><ArrowUpFromLine size={17} /> Restore backup</button></div>
      <div className="warning-box"><b>Reset app data</b><p>This removes everything saved in this browser.</p><button className="danger-btn" onClick={onReset}><Trash2 size={15} /> Reset this browser's data</button></div></section>
  </>;
}
