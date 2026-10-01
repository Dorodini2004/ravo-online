"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  lessons,
  questions,
  glossary,
  sources,
  type Question,
} from "./content";
import {
  emptyStore,
  emptyProfile,
  STORAGE_KEY,
  validateStore,
  recordAttempt,
  reviewError,
  viennaDay,
  shuffle,
  PRACTICE_IDS,
  learningRhythm,
} from "./logic.mjs";
import type { Store, Profile, ProfileName, Attempt, Note } from "./types";
import Icon from "./Icon";
import Chart from "./Chart";
import Exercises, { Calculators, exerciseNames } from "./Exercises";
import Quiz from "./Quiz";

const nav = [
  ["dashboard", "Dashboard", "dashboard"],
  ["path", "14-Tage-Lernpfad", "path"],
  ["lessons", "Lektionen", "book"],
  ["practice", "Übungsbereich", "chart"],
  ["tests", "Tests", "test"],
  ["errors", "Fehler & Wiederholungen", "repeat"],
  ["rules", "Regelbuch", "shield"],
  ["glossary", "Tradinglexikon", "search"],
  ["journal", "Lernjournal", "note"],
  ["settings", "Einstellungen", "settings"],
];
const questionMap = new Map(questions.map((q) => [q.id, q]));
const questionIds = new Set(questions.map((q) => q.id));
const dateLabel = (at: number) =>
  new Intl.DateTimeFormat("de-AT", {
    dateStyle: "medium",
    timeZone: "Europe/Vienna",
  }).format(at);
const minutes = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
function latestPractice(p: Profile, id: string) {
  return p.practice.filter((x) => x.id === id).at(-1)?.passed === true;
}
function testPassed(p: Profile, id: string) {
  return p.attempts.some((a) => a.id === id && a.score >= 80);
}
function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}

export default function Academy() {
  const [now, setNow] = useState(0);
  const [store, setStore] = useState<Store>(emptyStore as () => Store);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [day, setDay] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const [blockedStorage, setBlockedStorage] = useState(false);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState<string | null>(null);
  const [solution, setSolution] = useState(false);
  const [quiz, setQuiz] = useState<{
    items: Question[];
    label: string;
    id: string;
  } | null>(null);
  const [practiceInitial, setPracticeInitial] = useState("ohlc");
  const [practiceKey, setPracticeKey] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [timerBase, setTimerBase] = useState<number | null>(null);
  const [timerSaved, setTimerSaved] = useState(0);
  const [reviewAnswer, setReviewAnswer] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [note, setNote] = useState({
    topic: "",
    insight: "",
    mistake: "",
    next: "",
  });
  const [editNote, setEditNote] = useState<string | null>(null);
  const [customRule, setCustomRule] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const p = store.profiles[store.active];
  useEffect(() => {
    const hydrate = setTimeout(() => {
      setNow(Date.now());
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const loaded = validateStore(JSON.parse(raw), questionIds) as Store;
          setStore(loaded);
        }
      } catch {
        setStorageError(
          "Die vorhandenen lokalen Daten konnten nicht geladen werden. Sie bleiben unverändert gespeichert. Exportiere die Rohdaten in den Einstellungen oder importiere eine geprüfte Sicherung.",
        );
        setBlockedStorage(true);
      }
      setReady(true);
      readHash();
    }, 0);
    const readHash = () => {
      const hash = window.location.hash.slice(1);
      const [section, d] = hash.split("/");
      if (nav.some((n) => n[0] === section)) {
        setPage(section);
        if (
          d &&
          Number.isInteger(Number(d)) &&
          Number(d) >= 1 &&
          Number(d) <= 14
        )
          setDay(Number(d));
      }
    };
    window.addEventListener("hashchange", readHash);
    return () => {
      clearTimeout(hydrate);
      window.removeEventListener("hashchange", readHash);
    };
  }, []);
  useEffect(() => {
    if (!ready || blockedStorage) return;
    const save = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        setStorageError("");
      } catch {
        setStorageError(
          "Speichern im Browser ist fehlgeschlagen. Bitte jetzt eine JSON-Sicherung exportieren.",
        );
      }
    }, 0);
    return () => clearTimeout(save);
  }, [store, ready, blockedStorage]);
  useEffect(() => {
    if (!running || timerBase === null) return;
    const tick = () =>
      setSeconds(
        Math.min(
          43200,
          timerSaved + Math.floor((Date.now() - timerBase) / 1000),
        ),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running, timerBase, timerSaved]);
  useEffect(() => {
    const refresh = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(refresh);
  }, []);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (running || seconds > 0) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [running, seconds]);
  function update(fn: (profile: Profile) => Profile) {
    setStore((s) => ({
      ...s,
      profiles: { ...s.profiles, [s.active]: fn(s.profiles[s.active]) },
    }));
  }
  function go(next: string, d?: number) {
    setPage(next);
    setQuiz(null);
    setMobile(false);
    setSolution(false);
    setReviewFeedback("");
    if (d) setDay(d);
    window.location.assign("#" + next + (d ? `/${d}` : ""));
    window.scrollTo({ top: 0, behavior: "instant" });
    mainRef.current?.focus();
  }
  function endTimer() {
    const elapsed =
      running && timerBase !== null
        ? Math.min(
            43200,
            timerSaved + Math.floor((Date.now() - timerBase) / 1000),
          )
        : seconds;
    if (elapsed > 0)
      update((prev) => ({
        ...prev,
        sessions: [...prev.sessions, { date: viennaDay(), seconds: elapsed }],
      }));
    setRunning(false);
    setSeconds(0);
    setTimerSaved(0);
    setTimerBase(null);
  }
  function switchProfile(name: ProfileName) {
    if (name === store.active) return;
    endTimer();
    setStore((s) => ({ ...s, active: name }));
    setQuiz(null);
    setNote({ topic: "", insight: "", mistake: "", next: "" });
    setEditNote(null);
    setReviewIndex(0);
    setReviewAnswer("");
    setReviewFeedback("");
    setPracticeKey((k) => k + 1);
    setMessage(`Lokales Lernprofil ${name} ist aktiv.`);
  }
  function finish(attempt: Attempt) {
    update((prev) => recordAttempt(prev, attempt, questionMap) as Profile);
  }
  function startTest(id: string) {
    let items: Question[], label: string;
    if (id.startsWith("day-")) {
      const d = Number(id.slice(4));
      items = lessons[d - 1].quiz;
      label = `Tag ${d} · ${lessons[d - 1].title}`;
    } else {
      const days = id === "mid" ? 7 : 14;
      const perDay = Array.from(
        { length: days },
        (_, i) => shuffle(lessons[i].quiz) as Question[],
      );
      items = perDay.flatMap((q) => q.slice(0, 2));
      const remaining = shuffle(
        perDay.flatMap((q) => q.slice(2)),
      ) as Question[];
      items = [
        ...items,
        ...remaining.slice(0, (id === "mid" ? 20 : 30) - items.length),
      ];
      label =
        id === "mid"
          ? "Zwischentest · Tage 1–7"
          : "Abschlusstest · Alle Grundlagen";
    }
    setQuiz({ items: shuffle(items) as Question[], label, id });
    setPage("tests");
    window.location.assign("#tests");
    window.scrollTo({ top: 0 });
  }
  function openPractice(id = "ohlc") {
    setPracticeInitial(id);
    setPracticeKey((k) => k + 1);
    go("practice");
  }
  function result(id: string, passed: boolean, variant: number) {
    update((prev) => ({
      ...prev,
      practice: [...prev.practice, { id, passed, at: Date.now(), variant }],
    }));
  }
  function download(data: string, name: string) {
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importData(file: File) {
    try {
      if (file.size > 5_000_000) throw Error("Datei zu groß (maximal 5 MB).");
      const next = validateStore(
        JSON.parse(await file.text()),
        questionIds,
      ) as Store;
      // Validate answer truth against our stable question bank, not imported flags.
      for (const profile of Object.values(next.profiles)) {
        for (const a of profile.attempts) {
          const validId =
            /^day-([1-9]|1[0-4])$/.test(a.id) ||
            ["mid", "final"].includes(a.id);
          const expectedCount = a.id === "mid" ? 20 : a.id === "final" ? 30 : 8;
          if (!validId || a.answers.length !== expectedCount)
            throw Error("Unpassender Testumfang.");
          for (const ans of a.answers) {
            const q = questionMap.get(ans.id)!;
            if (
              !q.options.includes(ans.answer) ||
              ans.correct !== (ans.answer === q.correct)
            )
              throw Error(
                "Antwortbewertung stimmt nicht mit der Frage überein.",
              );
            if (a.id.startsWith("day-") && q.day !== Number(a.id.slice(4)))
              throw Error("Frage gehört nicht zu diesem Tagesquiz.");
            if (a.id === "mid" && q.day > 7)
              throw Error("Zwischentest enthält ein falsches Thema.");
          }
        }
        for (const e of profile.errors)
          if (questionMap.get(e.id)?.day !== e.day)
            throw Error("Fehlerliste enthält falsche Themenzuordnung.");
      }
      if (
        !confirm(
          `Geprüfte Sicherung importieren? Beide lokalen Profile werden ersetzt (${next.profiles.Patrik.attempts.length} Tests für Patrik, ${next.profiles.Fabian.attempts.length} für Fabian). Vorher bei Bedarf exportieren.`,
        )
      )
        return;
      setRunning(false);
      setSeconds(0);
      setTimerSaved(0);
      setTimerBase(null);
      setBlockedStorage(false);
      setStore(next);
      setQuiz(null);
      setMessage("Sicherung erfolgreich geprüft und importiert.");
      setStorageError("");
    } catch (error) {
      setMessage(
        `Import abgelehnt: ${error instanceof Error ? error.message : "Ungültige Datei."}`,
      );
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }
  const understood = lessons.filter((l) =>
    testPassed(p, `day-${l.day}`),
  ).length;
  const nextDay =
    lessons.find((l) => !testPassed(p, `day-${l.day}`))?.day || 14;
  const pending = p.errors.filter((e) => !e.resolved);
  const due = pending.filter((e) => e.due <= now);
  const practiceFailures = PRACTICE_IDS.filter(
    (id) => p.practice.filter((x) => x.id === id).at(-1)?.passed === false,
  );
  const totalSeconds = p.sessions.reduce((n, s) => n + s.seconds, 0);
  const rhythm = learningRhythm(p.sessions);
  const activeDays = new Set(rhythm.days);
  const recent = p.attempts.slice(-3).reverse();
  const stats = lessons.map((l) => {
    const a = p.attempts
      .flatMap((a) => a.answers)
      .filter((a) => questionMap.get(a.id)?.day === l.day);
    return {
      day: l.day,
      title: l.title,
      total: a.length,
      rate: a.length ? a.filter((x) => x.correct).length / a.length : 0,
    };
  });
  const strengths = stats
    .filter((s) => s.total >= 8 && s.rate >= 0.8)
    .sort((a, b) => b.rate - a.rate);
  const weak = stats
    .filter((s) => s.total && s.rate < 0.8)
    .sort((a, b) => a.rate - b.rate);
  const coursePassed =
    understood === 14 &&
    testPassed(p, "mid") &&
    testPassed(p, "final") &&
    PRACTICE_IDS.every((id) => latestPractice(p, id));
  const currentLesson = lessons[day - 1];
  function linked(text: string) {
    const terms = [...glossary].sort((a, b) => b[0].length - a[0].length);
    const regex = new RegExp(
      `(${terms.map((t) => t[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "g",
    );
    return text.split(regex).map((part, i) =>
      terms.some((t) => t[0] === part) ? (
        <button className="term-link" key={i} onClick={() => setTerm(part)}>
          {part}
        </button>
      ) : (
        part
      ),
    );
  }
  function lessonCard(l: typeof currentLesson) {
    return (
      <button
        className="lesson-card"
        key={l.day}
        onClick={() => go("lessons", l.day)}
      >
        <span
          className={`day-number ${testPassed(p, `day-${l.day}`) ? "done" : ""}`}
        >
          {testPassed(p, `day-${l.day}`) ? (
            <Icon name="check" />
          ) : (
            String(l.day).padStart(2, "0")
          )}
        </span>
        <div>
          <span className="eyebrow">
            TAG {l.day} · {l.category}
          </span>
          <h3>{l.title}</h3>
          <p>{l.description}</p>
          <span className="small muted">
            <Icon name="clock" size={14} /> 45–60 Min · 8 Quizfragen
          </span>
        </div>
        <Icon name="arrow" />
      </button>
    );
  }
  if (!ready)
    return (
      <div className="academy loading">
        <span className="brand-mark">↗</span>
        <p>Dein Lernraum wird geöffnet …</p>
      </div>
    );
  return (
    <div className="academy">
      <a href="#academy-main" className="skip-link">
        Zum Inhalt
      </a>
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <a className="brand" href="#dashboard" onClick={() => go("dashboard")}>
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M7 24V14m7 10V8m7 16V12m6 12V4"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span>
            Trading Basics<small>ACADEMY</small>
          </span>
        </a>
        <div className="sidebar-label">DEIN LERNRAUM</div>
        <nav aria-label="Hauptnavigation">
          {nav.slice(0, 6).map(([id, label, icon]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                go(id);
              }}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {id === "errors" && pending.length > 0 && (
                <b className="nav-count">{pending.length}</b>
              )}
            </a>
          ))}
          <div className="sidebar-label resources-label">DEINE WERKZEUGE</div>
          {nav.slice(6, 9).map(([id, label, icon]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                go(id);
              }}
              className={page === id ? "active" : ""}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safe-space">
            <span className="safe-icon">
              <Icon name="leaf" />
            </span>
            <strong>Wissen wächst mit dir.</strong>
            <p>
              Keine Eile. Kein Echtgeld.
              <br />
              Ein Schritt nach dem anderen.
            </p>
            <span className="status-dot" /> Dein sicherer Lernraum
          </div>
          <a
            href="#settings"
            onClick={(e) => {
              e.preventDefault();
              go("settings");
            }}
            className={
              page === "settings" ? "active settings-link" : "settings-link"
            }
          >
            <Icon name="settings" />
            Einstellungen
          </a>
          <button className="sidebar-user" onClick={() => go("settings")}>
            <span className="avatar">{store.active[0]}</span>
            <span>
              <strong>{store.active}</strong>
              <small>Lokales Lernprofil</small>
            </span>
            <span className="user-dots">···</span>
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Navigation schließen"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              aria-label="Navigation öffnen"
              onClick={() => setMobile(!mobile)}
            >
              ☰
            </button>
            <span>Dein Lernraum</span>
            <span>/</span>
            <strong>{nav.find((n) => n[0] === page)?.[1]}</strong>
          </div>
          <div className="topbar-right">
            <span className="simulation-pill">
              <span className="status-dot" /> Nur Simulation
            </span>
            <span className="topbar-divider" />
            <label className="profile-select">
              <span className="avatar small-avatar">{store.active[0]}</span>
              <span className="sr-only">Aktives Profil</span>
              <select
                value={store.active}
                onChange={(e) => switchProfile(e.target.value as ProfileName)}
              >
                <option>Patrik</option>
                <option>Fabian</option>
              </select>
            </label>
          </div>
        </header>
        <main id="academy-main" tabIndex={-1} ref={mainRef}>
          {storageError && (
            <div className="feedback incorrect" role="alert">
              {storageError}
            </div>
          )}
          {message && (
            <div className="toast" role="status">
              <span>{message}</span>
              <button
                aria-label="Hinweis schließen"
                onClick={() => setMessage("")}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {page === "dashboard" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow greeting">
                    <Icon name="sun" size={16} /> DEIN NÄCHSTER SCHRITT ZÄHLT
                  </div>
                  <h1>
                    Schön, dass du da bist, {store.active}
                    <span className="lime">.</span>
                  </h1>
                  <p>
                    Verstehe die Grundlagen. Entwickle deinen Blick. Lerne in
                    deinem Tempo.
                  </p>
                </div>
                <div className="day-chip">
                  <Icon name="path" />
                  <span>
                    Dein Lernpfad<strong>Tag {nextDay} von 14</strong>
                  </span>
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">
                    Lernfortschritt <Icon name="book" size={18} />
                  </div>
                  <div className="stat-number">
                    {Math.round((p.read.length / 14) * 100)}
                    <span>%</span>
                    <small>{p.read.length} / 14 Lektionen bearbeitet</small>
                  </div>
                  <progress value={p.read.length} max={14} />
                </div>
                <div className="stat-card">
                  <div className="stat-label">
                    Verständnis nachgewiesen <Icon name="shield" size={18} />
                  </div>
                  <div className="stat-number">
                    {understood}
                    <span>/ 14</span>
                  </div>
                  <span className="small muted">
                    Bestandene Tagesquiz · ab 80 %
                  </span>
                </div>
                <div className="stat-card">
                  <div className="stat-label">
                    Zeit fürs Lernen <Icon name="clock" size={18} />
                  </div>
                  <div className="stat-number">
                    {Math.floor(totalSeconds / 60)}
                    <span>Min</span>
                  </div>
                  <span className="small muted">
                    Bewusst investiert. In dich.
                  </span>
                </div>
                <div className="stat-card">
                  <div className="stat-label">
                    Wiederholungen <Icon name="repeat" size={18} />
                  </div>
                  <div className="stat-number">
                    {due.length}
                    <span>heute fällig</span>
                  </div>
                  <button className="text-button" onClick={() => go("errors")}>
                    {pending.length
                      ? `${pending.length} insgesamt offen`
                      : "Noch keine offenen Fragen"}{" "}
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              </div>
              <div className="dashboard-main">
                <div className="dashboard-left">
                  <section className="continue-card">
                    <div className="continue-content">
                      <Tag>DEIN LERNPFAD · TAG {nextDay}</Tag>
                      <h2>{lessons[nextDay - 1].title}</h2>
                      <p>
                        {lessons[nextDay - 1].description}
                        <br />
                        Dein Fundament für bewusste Entscheidungen.
                      </p>
                      <div className="lesson-meta">
                        <span>
                          <Icon name="clock" size={16} /> 45–60 Min
                        </span>
                        <span>
                          <Icon name="book" size={16} /> Wissen + Praxis
                        </span>
                      </div>
                      <button
                        className="primary"
                        onClick={() => go("lessons", nextDay)}
                      >
                        Weiterlernen <Icon name="arrow" size={18} />
                      </button>
                    </div>
                    <div className="hero-chart-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <svg viewBox="0 0 300 240">
                        <path
                          d="M0 190 45 172 85 184 120 125 157 145 192 87 230 101 300 36"
                          stroke="#baf48e"
                          opacity=".3"
                          fill="none"
                          strokeWidth="1.5"
                        />
                        {[
                          [35, 141, 47],
                          [73, 150, 33],
                          [111, 112, 54],
                          [149, 130, 32],
                          [187, 69, 62],
                          [225, 80, 31],
                          [263, 30, 62],
                        ].map(([x, y, h], i) => (
                          <g key={x}>
                            <line
                              x1={x + 8}
                              x2={x + 8}
                              y1={y - 13}
                              y2={y + h + 15}
                              stroke={i % 2 ? "#668b71" : "#c1f58d"}
                              strokeWidth="2"
                            />
                            <rect
                              x={x}
                              y={y}
                              width="16"
                              height={h}
                              rx="3"
                              fill={i % 2 ? "#507658" : "#b9ec87"}
                            />
                          </g>
                        ))}
                      </svg>
                      <span className="art-label">
                        KLEINE SCHRITTE. STARKES FUNDAMENT.
                      </span>
                    </div>
                  </section>
                  <section className="panel chart-panel">
                    <div className="section-heading">
                      <div>
                        <div className="eyebrow">VOM WISSEN ZUM VERSTEHEN</div>
                        <h2>Entdecke den Chart</h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => openPractice()}
                      >
                        Jetzt üben <Icon name="arrow" size={16} />
                      </button>
                    </div>
                    <p className="small muted">
                      Wähle eine Kerze aus und entdecke ihre vier Preise.
                    </p>
                    <Chart compact />
                    <div className="chart-tip">
                      <Icon name="chart" size={18} />
                      <span>
                        Jede Kerze erzählt eine Geschichte. Lerne, sie zu lesen.
                      </span>
                    </div>
                  </section>
                  <section>
                    <div className="section-heading">
                      <h2>Deine nächsten Etappen</h2>
                      <button
                        className="text-button"
                        onClick={() => go("path")}
                      >
                        Lernpfad ansehen <Icon name="arrow" size={16} />
                      </button>
                    </div>
                    <div className="next-lessons">
                      {lessons
                        .slice(Math.min(nextDay, 11), Math.min(nextDay, 11) + 3)
                        .map((l) => (
                          <button
                            key={l.day}
                            onClick={() => go("lessons", l.day)}
                          >
                            <span className="eyebrow">
                              TAG {String(l.day).padStart(2, "0")}
                            </span>
                            <Icon
                              name={l.day % 2 ? "chart" : "book"}
                              size={23}
                            />
                            <h3>{l.title}</h3>
                            <span className="small muted">
                              45–60 Min <Icon name="arrow" size={14} />
                            </span>
                          </button>
                        ))}
                    </div>
                  </section>
                </div>
                <div className="dashboard-right">
                  <section className="panel timer-panel">
                    <div className="section-heading">
                      <h2>Deine Fokuszeit</h2>
                      <Icon name="clock" />
                    </div>
                    <p>Ein bisschen Ruhe. Ein klarer Kopf.</p>
                    <div className="timer-digits">
                      {minutes(seconds)}
                      <span>MINUTEN : SEKUNDEN</span>
                    </div>
                    <button
                      className="timer-start"
                      onClick={() => {
                        if (running) {
                          setRunning(false);
                          setTimerSaved(seconds);
                          setTimerBase(null);
                        } else {
                          setTimerBase(Date.now());
                          setRunning(true);
                        }
                      }}
                    >
                      <Icon name={running ? "clock" : "play"} size={16} />
                      {running
                        ? "Pause"
                        : seconds
                          ? "Weiterlernen"
                          : "Lernsession starten"}
                    </button>
                    {seconds > 0 && (
                      <button
                        className="text-button timer-end"
                        onClick={endTimer}
                      >
                        Session beenden & speichern
                      </button>
                    )}
                    <div className="timer-foot">
                      <Icon name="leaf" size={15} />
                      <span>Dein Tempo ist das richtige Tempo.</span>
                    </div>
                  </section>
                  <section className="panel rhythm-panel">
                    <div className="section-heading">
                      <h2>Dein Lernrhythmus</h2>
                      <span className="lime">
                        <Icon name="leaf" />
                      </span>
                    </div>
                    <p>
                      <strong>{activeDays.size} aktive Lerntage</strong>
                      <br />
                      <span className="small muted">
                        Ab einer gespeicherten Lernminute.
                      </span>
                    </p>
                    <div className="week-days">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(now - (6 - i) * 86400000);
                        const key = viennaDay(d);
                        return (
                          <div key={key}>
                            <span>
                              {new Intl.DateTimeFormat("de-AT", {
                                weekday: "narrow",
                                timeZone: "Europe/Vienna",
                              }).format(d)}
                            </span>
                            <b className={activeDays.has(key) ? "learned" : ""}>
                              {activeDays.has(key) ? "✓" : "·"}
                            </b>
                          </div>
                        );
                      })}
                    </div>
                    <p className="small muted">
                      Letzte Lernserie: {rhythm.streak} Tage. Pausen gehören
                      dazu. Dein Fortschritt bleibt.
                    </p>
                  </section>
                  <section className="panel understanding-panel">
                    <div className="section-heading">
                      <h2>Dein Verständnis</h2>
                      <Icon name="shield" />
                    </div>
                    {strengths.length || weak.length ? (
                      <>
                        <div className="small positive">STÄRKEN</div>
                        <p>
                          {strengths
                            .slice(0, 2)
                            .map((s) => s.title)
                            .join(", ") || "Noch keine gesicherten Stärken."}
                        </p>
                        <div className="small warm">NOCH VERTIEFEN</div>
                        <p>
                          {weak
                            .slice(0, 2)
                            .map((s) => s.title)
                            .join(", ") ||
                            "Bisher keine auffälligen Schwierigkeiten."}
                        </p>
                      </>
                    ) : (
                      <div className="empty-understanding">
                        <span className="empty-icon">
                          <Icon name="path" size={28} />
                        </span>
                        <h3>Hier wächst dein Überblick.</h3>
                        <p>
                          Nach deinem ersten Quiz siehst du, was schon sitzt und
                          was du vertiefen kannst.
                        </p>
                      </div>
                    )}
                    <button className="text-button" onClick={() => go("tests")}>
                      Zu deinen Tests <Icon name="arrow" size={15} />
                    </button>
                  </section>
                </div>
              </div>
              <section className="panel recent-panel">
                <div className="section-heading">
                  <h2>Letzte Testergebnisse</h2>
                  <button className="text-button" onClick={() => go("tests")}>
                    Alle Ergebnisse <Icon name="arrow" size={16} />
                  </button>
                </div>
                {recent.length ? (
                  recent.map((a, i) => (
                    <div className="result-row" key={i}>
                      <span>{a.label}</span>
                      <span className="muted">{dateLabel(a.at)}</span>
                      <strong className={a.score >= 80 ? "positive" : "warm"}>
                        {Math.round(a.score)} % ·{" "}
                        {a.score >= 80 ? "Bestanden" : "Weiter üben"}
                      </strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    Dein erster Test wartet auf dich. Hier erscheinen nur deine
                    tatsächlich abgegebenen Ergebnisse.
                  </p>
                )}
              </section>
            </>
          )}
          {page === "path" && (
            <>
              <PageHeading
                eyebrow="14 TAGE · DEIN TEMPO"
                title="Ein Fundament, das bleibt."
                text="45–60 Minuten Kernsession pro Tag. Optional bis etwa 2 Stunden vertiefen. Wiederholen und langsamer lernen ist jederzeit möglich."
              />
              <div className="callout path-summary">
                <Icon name="path" />
                <span>
                  {p.read.length} Lektionen bearbeitet · {understood} Tagesquiz
                  bestanden. Lesen und Verständnis zählen getrennt.
                </span>
              </div>
              {[
                "Das Fundament",
                "Charts verstehen",
                "Wiederholen & verbinden",
                "Marktmechanik",
                "Risiko verstehen",
                "Dein Lernprozess",
              ].map((category) => (
                <section className="path-group" key={category}>
                  <h2>{category}</h2>
                  <div className="lesson-grid">
                    {lessons
                      .filter((l) => l.category === category)
                      .map(lessonCard)}
                  </div>
                </section>
              ))}
            </>
          )}
          {page === "lessons" && (
            <>
              <PageHeading
                eyebrow={`TAG ${day} VON 14 · ${currentLesson.category.toUpperCase()}`}
                title={currentLesson.title}
                text={currentLesson.description}
              />
              <div className="lesson-select">
                <label>
                  Lektion wählen
                  <select
                    value={day}
                    onChange={(e) => go("lessons", Number(e.target.value))}
                  >
                    {lessons.map((l) => (
                      <option key={l.day} value={l.day}>
                        Tag {l.day} · {l.title}
                      </option>
                    ))}
                  </select>
                </label>
                <Tag>45–60 MIN KERNSESSION</Tag>
              </div>
              <div className="lesson-reading">
                <article className="panel prose">
                  <div className="eyebrow">DAS NIMMST DU MIT</div>
                  <ul>
                    {currentLesson.goals.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                  <div className="session-plan">
                    <span>15 Min verstehen</span>
                    <span>20 Min anwenden</span>
                    <span>10–25 Min prüfen</span>
                  </div>
                  {currentLesson.sections.map(([title, text]) => (
                    <section key={title}>
                      <h2>{title}</h2>
                      <p>{linked(text)}</p>
                    </section>
                  ))}
                  <div className="callout">
                    <strong>Ein konkretes Beispiel</strong>
                    <p>{linked(currentLesson.example)}</p>
                  </div>
                  {day >= 3 && day <= 6 ? (
                    <Chart />
                  ) : (
                    <div className="concept-strip">
                      <span>
                        01<b>Verstehen</b>
                      </span>
                      <Icon name="arrow" />
                      <span>
                        02<b>Anwenden</b>
                      </span>
                      <Icon name="arrow" />
                      <span>
                        03<b>Überprüfen</b>
                      </span>
                    </div>
                  )}
                  <section>
                    <h2>Jetzt bist du dran</h2>
                    <p>{currentLesson.task}</p>
                    <button
                      className="secondary"
                      aria-expanded={solution}
                      onClick={() => setSolution(!solution)}
                    >
                      {solution
                        ? "Musterlösung ausblenden"
                        : "Musterlösung aufdecken"}
                    </button>
                    {solution && (
                      <div className="feedback correct">
                        {currentLesson.solution}
                      </div>
                    )}
                  </section>
                  <section>
                    <h2>Typische Anfängerfehler</h2>
                    <p>{currentLesson.mistakes}</p>
                  </section>
                  <section>
                    <h2>Das Wichtigste in einem Satz</h2>
                    <p className="summary-text">{currentLesson.summary}</p>
                  </section>
                  <section>
                    <h2>Optionale Vertiefung · 30–60 Min</h2>
                    <p>{currentLesson.extension}</p>
                  </section>
                  <div className="actions">
                    <button
                      className="secondary"
                      onClick={() => {
                        update((prev) => ({
                          ...prev,
                          read: prev.read.includes(day)
                            ? prev.read
                            : [...prev.read, day],
                        }));
                        setMessage(
                          "Als bearbeitet gespeichert. Verständnis wird durch das Quiz nachgewiesen.",
                        );
                      }}
                    >
                      {p.read.includes(day)
                        ? "✓ Als bearbeitet gespeichert"
                        : "Lektion als bearbeitet markieren"}
                    </button>
                    <button
                      className="primary"
                      onClick={() => startTest(`day-${day}`)}
                    >
                      Wissen testen · 8 Fragen <Icon name="arrow" />
                    </button>
                  </div>
                  <p className="small muted">
                    Fachbegriffe sind anklickbar. Das Öffnen einer Lektion zählt
                    nicht als Beherrschung.
                  </p>
                </article>
                <aside className="lesson-aside">
                  <section className="panel">
                    <h3>Wissen wird durch Üben klar.</h3>
                    <p>
                      Probiere die passende Aufgabe mit simulierten Daten aus.
                    </p>
                    <button
                      className="primary"
                      onClick={() =>
                        openPractice(
                          (
                            {
                              3: "ohlc",
                              4: "ohlc",
                              5: "structure",
                              6: "zones",
                              8: "orders",
                              9: "orders",
                              10: "leverage",
                              11: "size",
                              12: "expectancy",
                              13: "backtest",
                            } as Record<number, string>
                          )[day] || "rules",
                        )
                      }
                    >
                      Zur Praxis <Icon name="arrow" />
                    </button>
                  </section>
                  <section className="panel">
                    <h3>Deine Lernnotiz</h3>
                    <p>
                      Was hat heute Klick gemacht? Was möchtest du nochmals
                      ansehen?
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setNote({ ...note, topic: currentLesson.title });
                        go("journal");
                      }}
                    >
                      Gedanken festhalten
                    </button>
                  </section>
                  <section className="panel small">
                    <h3>Quellen & Einordnung</h3>
                    <p>
                      Geprüft am 01.10.2026. Rechen- und Chartbeispiele sind
                      eigene Simulationen. Swing-Regeln und Toleranzen sind
                      Lehrkonventionen.
                    </p>
                    {sources.map((s) => (
                      <a
                        className="source-link"
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        key={s.url}
                      >
                        {s.title} ↗
                      </a>
                    ))}
                  </section>
                </aside>
              </div>
            </>
          )}
          {page === "practice" && (
            <>
              <PageHeading
                eyebrow="AUSPROBIEREN. VERSTEHEN. WIEDERHOLEN."
                title="Dein Übungsbereich"
                text="Zwölf echte Aufgabentypen. Simulierte Daten, ehrliches Feedback und so viele Versuche, wie du brauchst."
              />
              <Exercises
                key={`${store.active}-${practiceKey}`}
                onResult={result}
                initial={practiceInitial}
              />
              <div className="section-heading calculator-heading">
                <h2>Deine Rechenwerkzeuge</h2>
                <Tag>FREI GEWÄHLTE ÜBUNGSWERTE</Tag>
              </div>
              <Calculators />
            </>
          )}
          {page === "tests" && (
            <>
              <PageHeading
                eyebrow="WISSEN SICHTBAR MACHEN"
                title="Deine Lernnachweise"
                text="Ab 80 % ist ein Wissenstest bestanden. Orderausführung, Geldrisiko, Positionsgröße und Hebel werden zusätzlich praktisch geprüft."
              />
              {quiz ? (
                <Quiz
                  key={`${quiz.id}-${store.active}`}
                  questions={quiz.items}
                  label={quiz.label}
                  testId={quiz.id}
                  onFinish={finish}
                  onClose={() => setQuiz(null)}
                />
              ) : (
                <>
                  <div className="test-cards">
                    <section className="panel">
                      <Tag>TAG 7 · 20 FRAGEN</Tag>
                      <h2>Der Zwischenstand</h2>
                      <p>
                        Produktwissen, Kerzen, Zeitrahmen und Marktstruktur
                        verbinden.
                      </p>
                      <button
                        className="primary"
                        onClick={() => startTest("mid")}
                      >
                        {testPassed(p, "mid")
                          ? "Erneut versuchen"
                          : "Zwischentest starten"}{" "}
                        <Icon name="arrow" />
                      </button>
                    </section>
                    <section className="panel">
                      <Tag>TAG 14 · 30 FRAGEN</Tag>
                      <h2>Das ganze Fundament</h2>
                      <p>
                        Alle Themen überprüfen. Danach den praktischen Teil
                        bearbeiten.
                      </p>
                      <button
                        className="primary"
                        onClick={() => startTest("final")}
                      >
                        {testPassed(p, "final")
                          ? "Erneut versuchen"
                          : "Abschlusstest starten"}{" "}
                        <Icon name="arrow" />
                      </button>
                    </section>
                  </div>
                  <section className="panel practice-proof">
                    <div className="section-heading">
                      <div>
                        <div className="eyebrow">
                          PRAKTISCHER TEIL DES ABSCHLUSSES
                        </div>
                        <h2>Erklären ist gut. Anwenden zeigt Verständnis.</h2>
                      </div>
                      <Icon name="shield" size={28} />
                    </div>
                    <div className="proof-grid">
                      {PRACTICE_IDS.map((id) => (
                        <button
                          key={id}
                          className={latestPractice(p, id) ? "passed" : ""}
                          onClick={() => openPractice(id)}
                        >
                          <span>{latestPractice(p, id) ? "✓" : "○"}</span>
                          {exerciseNames[id]}
                          <Icon name="arrow" size={14} />
                        </button>
                      ))}
                    </div>
                    <div
                      className={`callout ${coursePassed ? "positive" : ""}`}
                    >
                      <strong>
                        {coursePassed
                          ? "✓ Lernnachweis vollständig"
                          : "Dein Lernnachweis wächst mit jeder Aufgabe."}
                      </strong>
                      <p>
                        Vollständig mit 14 Tagesquiz, Zwischen- und
                        Abschlusstest (je ≥ 80 %) sowie allen zwölf
                        Praxisaufgaben. Bei Praxis zählt der letzte Versuch je
                        Typ. Kein Nachweis für profitables Echtgeldtrading und
                        keine Handelsfreigabe.
                      </p>
                    </div>
                  </section>
                  <h2>Tagesquiz · je 8 Fragen</h2>
                  <div className="daily-tests">
                    {lessons.map((l) => (
                      <button
                        className="panel"
                        key={l.day}
                        onClick={() => startTest(`day-${l.day}`)}
                      >
                        <span className="eyebrow">TAG {l.day}</span>
                        <strong>{l.title}</strong>
                        <span
                          className={
                            testPassed(p, `day-${l.day}`) ? "positive" : "muted"
                          }
                        >
                          {testPassed(p, `day-${l.day}`)
                            ? "✓ Bestanden"
                            : "Quiz starten →"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <section className="panel">
                    <h2>Alle abgegebenen Versuche</h2>
                    {p.attempts.length ? (
                      p.attempts
                        .slice()
                        .reverse()
                        .map((a, i) => (
                          <details className="attempt-details" key={i}>
                            <summary>
                              {a.label} · {Math.round(a.score)} % ·{" "}
                              {dateLabel(a.at)}
                            </summary>
                            {a.answers.map((ans) => (
                              <p key={ans.id}>
                                <strong>
                                  {ans.correct ? "✓" : "↻"}{" "}
                                  {questionMap.get(ans.id)?.prompt}
                                </strong>
                                <br />
                                Deine Antwort: {ans.answer}
                                <br />
                                Richtig: {questionMap.get(ans.id)?.correct}
                                <br />
                                <span className="muted">
                                  {questionMap.get(ans.id)?.explanation}
                                </span>
                              </p>
                            ))}
                          </details>
                        ))
                    ) : (
                      <p className="muted">
                        Noch keine Testergebnisse. Ein abgegebener Test wird
                        hier dauerhaft im lokalen Profil gespeichert.
                      </p>
                    )}
                  </section>
                </>
              )}
            </>
          )}
          {page === "errors" && (
            <>
              <PageHeading
                eyebrow="FEHLER SIND DEINE NÄCHSTEN LERNZIELE"
                title="Noch einmal. Mit mehr Verständnis."
                text="Falsche Quizantworten werden nach ungefähr 1, 3 und 7 Tagen erneut abgefragt. Nach drei richtigen Wiederholungen sind sie erledigt."
              />
              <div className="two-col">
                <section className="panel">
                  <h2>
                    {due.length} heute fällig · {pending.length} offen
                  </h2>
                  {pending.length ? (
                    (() => {
                      const list = [...pending].sort((a, b) => a.due - b.due);
                      const item = list[reviewIndex % list.length];
                      const q = questionMap.get(item.id)!;
                      return (
                        <div key={item.id}>
                          <div className="eyebrow">
                            TAG {item.day} · RUNDE {item.stage + 1}/3 ·{" "}
                            {item.due > now
                              ? `FÄLLIG ${dateLabel(item.due)} · VORZEITIGES ÜBEN MÖGLICH`
                              : "JETZT FÄLLIG"}
                          </div>
                          <h3>{q.prompt}</h3>
                          <div className="answer-options">
                            {q.options
                              .slice()
                              .reverse()
                              .map((option) => (
                                <button
                                  key={option}
                                  className={
                                    reviewAnswer === option ? "selected" : ""
                                  }
                                  disabled={!!reviewFeedback}
                                  onClick={() => setReviewAnswer(option)}
                                >
                                  {option}
                                </button>
                              ))}
                          </div>
                          {reviewFeedback && (
                            <div className="feedback" role="status">
                              {reviewFeedback}
                            </div>
                          )}
                          <div className="actions">
                            <button
                              className="primary"
                              disabled={!reviewAnswer || !!reviewFeedback}
                              onClick={() => {
                                const correct = reviewAnswer === q.correct;
                                setReviewFeedback(
                                  `${correct ? "✓ Richtig." : "↻ Noch nicht richtig."} ${q.explanation} Richtige Antwort: ${q.correct}. ${correct ? (item.stage === 2 ? "Drei Wiederholungen geschafft." : `Nächste Runde in ${item.stage === 0 ? 3 : 7} Tagen.`) : "Erneut in einem Tag."}`,
                                );
                              }}
                            >
                              Antwort prüfen
                            </button>
                            <button
                              className="secondary"
                              onClick={() => {
                                if (reviewFeedback) {
                                  update((prev) => ({
                                    ...prev,
                                    errors: prev.errors.map((e) =>
                                      e.id === item.id
                                        ? reviewError(
                                            e,
                                            reviewAnswer === q.correct,
                                          )
                                        : e,
                                    ),
                                  }));
                                }
                                setReviewFeedback("");
                                setReviewAnswer("");
                                setReviewIndex((i) => i + 1);
                              }}
                            >
                              {reviewFeedback
                                ? "Ergebnis speichern & weiter"
                                : "Nächste Frage"}
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="empty-state">
                      <Icon name="leaf" size={36} />
                      <h3>Platz für neue Erkenntnisse.</h3>
                      <p>
                        Noch keine offenen Quizfehler. Fehler aus abgegebenen
                        Tests erscheinen automatisch hier.
                      </p>
                      <button className="secondary" onClick={() => go("tests")}>
                        Zu den Tests
                      </button>
                    </div>
                  )}
                </section>
                <section className="panel">
                  <h2>Praxis noch vertiefen</h2>
                  {practiceFailures.length ? (
                    practiceFailures.map((id) => (
                      <button
                        className="review-row"
                        key={id}
                        onClick={() => openPractice(id)}
                      >
                        <span>{exerciseNames[id]}</span>
                        <Icon name="arrow" />
                      </button>
                    ))
                  ) : (
                    <p className="muted">
                      Keine offenen Fehler aus deinen letzten Praxisversuchen.
                    </p>
                  )}
                  <h3>Wiederholungsplan</h3>
                  <p>
                    Falsche Antworten: +1 Tag. Danach richtig: +3 Tage, dann +7
                    Tage. Die dritte richtige Wiederholung schließt den Eintrag.
                    Eine falsche Wiederholung startet wieder bei +1 Tag.
                  </p>
                  <p className="small muted">
                    Frühzeitiges Üben ist erlaubt. Versäumte Termine löschen
                    keinen Fortschritt.
                  </p>
                  {p.errors.filter((e) => e.resolved).length > 0 && (
                    <p className="positive">
                      ✓ {p.errors.filter((e) => e.resolved).length} Fragen
                      erfolgreich wiederholt
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
          {page === "rules" && (
            <>
              <PageHeading
                eyebrow="KLARHEIT VOR JEDER ENTSCHEIDUNG"
                title="Dein Regelbuch"
                text="Marktmechanik, persönliche Prozessregeln und selbst gewählte Übungsgrenzen haben unterschiedliche Aufgaben."
              />
              <div className="rules-grid">
                <section className="panel">
                  <Tag>01 · MARKTMECHANIK</Tag>
                  <h2>So funktioniert das Modell</h2>
                  <ul>
                    <li>Ein Punktwert gehört zu einem konkreten Produkt.</li>
                    <li>Market-Orders haben keine feste Preisgarantie.</li>
                    <li>Limit-Orders können unausgeführt bleiben.</li>
                    <li>
                      Stop-Loss begrenzt den tatsächlichen Verlust nicht sicher
                      auf den geplanten Betrag.
                    </li>
                    <li>Margin ist eine Sicherheit, kein Verlustdeckel.</li>
                  </ul>
                </section>
                <section className="panel">
                  <Tag>02 · PERSÖNLICHER PROZESS</Tag>
                  <h2>So bleibe ich nachvollziehbar</h2>
                  <ul>
                    <li>Instrument, Punktwert und Kosten vorher kennen.</li>
                    <li>Risiko vor dem Einstieg berechnen.</li>
                    <li>Geplantes Risiko nicht impulsiv erhöhen.</li>
                    <li>Nach Verlusten nicht spontan die Menge erhöhen.</li>
                    <li>Auch Nicht-Handeln bewusst wählen können.</li>
                    <li>Entscheidungen dokumentieren und später auswerten.</li>
                  </ul>
                </section>
                <section className="panel">
                  <Tag>03 · FREI GEWÄHLTE GRENZEN</Tag>
                  <h2>Mein Simulationsrahmen</h2>
                  <p>
                    Es gibt keine universell richtige Risikoprozentzahl. Kleine
                    Beträge wie 30 € oder 50 € dienen hier allein dem Rechnen.
                    Eine persönliche Tagesverlustgrenze ist eine
                    Übungsvereinbarung.
                  </p>
                  {p.rules.map((r, i) => (
                    <div className="review-row" key={i}>
                      <span>{r}</span>
                      <button
                        className="icon-button"
                        aria-label={`Regel ${i + 1} löschen`}
                        onClick={() => {
                          if (confirm("Diese persönliche Regel löschen?"))
                            update((prev) => ({
                              ...prev,
                              rules: prev.rules.filter((_, j) => j !== i),
                            }));
                        }}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (customRule.trim()) {
                        update((prev) => ({
                          ...prev,
                          rules: [...prev.rules, customRule.trim()],
                        }));
                        setCustomRule("");
                      }
                    }}
                  >
                    <label>
                      Eigene Übungsregel
                      <textarea
                        maxLength={1000}
                        value={customRule}
                        onChange={(e) => setCustomRule(e.target.value)}
                        placeholder="Zum Beispiel: Nach zwei unklaren Entscheidungen mache ich eine Pause."
                      />
                    </label>
                    <button className="primary" disabled={!customRule.trim()}>
                      Regel hinzufügen
                    </button>
                  </form>
                </section>
              </div>
              <Sources />
            </>
          )}
          {page === "glossary" && (
            <>
              <PageHeading
                eyebrow="KLARE WORTE STATT FACHCHINESISCH"
                title="Dein Tradinglexikon"
                text="Begriffe einfach erklärt – mit einem konkreten Beispiel. Auch direkt aus den Lektionen erreichbar."
              />
              <label className="search-input">
                <Icon name="search" />
                <span className="sr-only">Lexikon durchsuchen</span>
                <input
                  placeholder="Begriff oder Erklärung suchen …"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="glossary-grid">
                {glossary
                  .filter((g) =>
                    g
                      .join(" ")
                      .toLocaleLowerCase("de")
                      .includes(search.toLocaleLowerCase("de")),
                  )
                  .map(([name, definition, example]) => (
                    <section className="panel" key={name}>
                      <h2>{name}</h2>
                      <p>{definition}</p>
                      <div className="glossary-example">{example}</div>
                    </section>
                  ))}
              </div>
              {!glossary.some((g) =>
                g.join(" ").toLowerCase().includes(search.toLowerCase()),
              ) && (
                <p className="empty-state">
                  Kein passender Begriff. Versuche einen kürzeren Suchtext.
                </p>
              )}
            </>
          )}
          {page === "journal" && (
            <>
              <PageHeading
                eyebrow="GEDANKEN FESTHALTEN. MUSTER ERKENNEN."
                title="Dein Lernjournal"
                text="Was du verstanden hast, ist genauso wichtig wie das, was du noch üben möchtest."
              />
              <div className="journal-layout">
                <form
                  className="panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!note.topic.trim() || !note.insight.trim()) return;
                    const entry: Note = {
                      ...note,
                      id: editNote || crypto.randomUUID(),
                      date: editNote
                        ? p.notes.find((n) => n.id === editNote)!.date
                        : viennaDay(),
                    };
                    update((prev) => ({
                      ...prev,
                      notes: editNote
                        ? prev.notes.map((n) => (n.id === editNote ? entry : n))
                        : [entry, ...prev.notes],
                    }));
                    setEditNote(null);
                    setNote({ topic: "", insight: "", mistake: "", next: "" });
                    setMessage("Lernnotiz im aktiven Profil gespeichert.");
                  }}
                >
                  <div className="eyebrow">
                    {editNote
                      ? "EINTRAG BEARBEITEN"
                      : `NEUER EINTRAG · ${viennaDay()}`}
                  </div>
                  <h2>Was nimmst du heute mit?</h2>
                  {Object.entries(note).map(([key, value]) => (
                    <label key={key}>
                      {
                        {
                          topic: "Thema *",
                          insight: "Meine Erkenntnis *",
                          mistake: "Fehler oder offene Frage",
                          next: "Mein nächster Übungsschritt",
                        }[key]
                      }
                      {key === "topic" ? (
                        <input
                          required
                          maxLength={200}
                          value={value}
                          onChange={(e) =>
                            setNote({ ...note, [key]: e.target.value })
                          }
                        />
                      ) : (
                        <textarea
                          required={key === "insight"}
                          maxLength={10000}
                          value={value}
                          onChange={(e) =>
                            setNote({ ...note, [key]: e.target.value })
                          }
                        />
                      )}
                    </label>
                  ))}
                  <button className="primary">
                    {editNote ? "Änderungen speichern" : "Lernnotiz speichern"}{" "}
                    <Icon name="note" />
                  </button>
                  {editNote && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setEditNote(null);
                        setNote({
                          topic: "",
                          insight: "",
                          mistake: "",
                          next: "",
                        });
                      }}
                    >
                      Abbrechen
                    </button>
                  )}
                </form>
                <div>
                  {p.notes.length ? (
                    p.notes.map((n) => (
                      <article className="panel journal-entry" key={n.id}>
                        <div className="eyebrow">
                          {n.date} · {store.active}
                        </div>
                        <h2>{n.topic}</h2>
                        <p>{n.insight}</p>
                        {n.mistake && (
                          <p>
                            <strong>Noch offen</strong>
                            <br />
                            {n.mistake}
                          </p>
                        )}
                        {n.next && (
                          <div className="callout">
                            <strong>Nächster Schritt</strong>
                            <p>{n.next}</p>
                          </div>
                        )}
                        <div className="actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setEditNote(n.id);
                              setNote({
                                topic: n.topic,
                                insight: n.insight,
                                mistake: n.mistake,
                                next: n.next,
                              });
                            }}
                          >
                            Bearbeiten
                          </button>
                          <button
                            className="text-button"
                            onClick={() => {
                              if (
                                confirm(
                                  "Diesen Journaleintrag wirklich löschen?",
                                )
                              )
                                update((prev) => ({
                                  ...prev,
                                  notes: prev.notes.filter(
                                    (x) => x.id !== n.id,
                                  ),
                                }));
                            }}
                          >
                            Löschen
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <section className="panel empty-state">
                      <Icon name="note" size={36} />
                      <h3>Dein erster Aha-Moment gehört hierhin.</h3>
                      <p>
                        Deine Notizen bleiben getrennt von denen des anderen
                        Profils und werden lokal gespeichert.
                      </p>
                    </section>
                  )}
                </div>
              </div>
            </>
          )}
          {page === "settings" && (
            <>
              <PageHeading
                eyebrow="DEIN LERNRAUM. DEINE DATEN."
                title="Einstellungen & Datensicherung"
                text="Lokale Lernprofile sind keine geschützten Benutzerkonten. Es gibt zunächst keine Synchronisierung zwischen Geräten."
              />
              <div className="two-col">
                <section className="panel">
                  <h2>Dein aktives Profil</h2>
                  <div className="profile-choices">
                    {(["Patrik", "Fabian"] as ProfileName[]).map((name) => (
                      <button
                        key={name}
                        className={store.active === name ? "selected" : ""}
                        onClick={() => switchProfile(name)}
                      >
                        <span className="avatar">{name[0]}</span>
                        <strong>{name}</strong>
                        <span>
                          {store.active === name ? "✓ Aktiv" : "Auswählen"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p>
                    Fortschritte, Tests, Fehler, Notizen, Lernzeit und Regeln
                    werden pro Profil getrennt gespeichert. Wer diesen Browser
                    benutzt, kann beide Profile öffnen.
                  </p>
                  <p className="small muted">
                    Gelöschte Browserdaten entfernen auch lokale Lernstände.
                    Regelmäßig exportieren.
                  </p>
                  <p className="small muted">
                    Jeder Browser und jede Website-Adresse hat einen eigenen
                    Lernstand. Beim Wechsel von der lokalen Vorschau zur
                    Online-Website: zuerst am bisherigen Ort JSON exportieren,
                    danach hier importieren. Auf einem anderen Gerät
                    funktioniert der Umzug genauso; eine automatische
                    Synchronisierung gibt es nicht.
                  </p>
                </section>
                <section className="panel">
                  <h2>Deine Sicherung</h2>
                  <p>
                    Der JSON-Export enthält beide Profile. Beim Import werden
                    Version, Struktur, Fragen, Antworten und Bewertungen
                    geprüft. Eine gültige Sicherung ersetzt nach Bestätigung
                    beide Profile.
                  </p>
                  <div className="actions">
                    <button
                      className="primary"
                      onClick={() =>
                        download(
                          JSON.stringify(store, null, 2),
                          `trading-basics-${viennaDay()}.json`,
                        )
                      }
                    >
                      <Icon name="download" /> JSON exportieren
                    </button>
                    <button
                      className="secondary"
                      onClick={() => importRef.current?.click()}
                    >
                      JSON importieren
                    </button>
                    <input
                      ref={importRef}
                      className="sr-only"
                      tabIndex={-1}
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void importData(file);
                      }}
                    />
                  </div>
                  {blockedStorage && (
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          localStorage.getItem(STORAGE_KEY) || "{}",
                          "academy-rohdaten.json",
                        )
                      }
                    >
                      Vorhandene Rohdaten retten
                    </button>
                  )}
                  <p className="small muted">
                    Sicherung lokal aufbewahren. Der Import lädt nichts auf
                    einen Server hoch.
                  </p>
                </section>
                <section className="panel">
                  <h2>Lernfortschritt zurücksetzen</h2>
                  <p>
                    Nur das aktive Profil {store.active} wird geleert. Das
                    andere Profil bleibt erhalten.
                  </p>
                  <button
                    className="danger-button"
                    onClick={() => {
                      if (
                        confirm(
                          `Alle Fortschritte, Tests, Fehler, Notizen, Regeln und Lernzeiten von ${store.active} endgültig löschen? Bitte vorher exportieren.`,
                        )
                      ) {
                        setRunning(false);
                        setSeconds(0);
                        setTimerSaved(0);
                        setTimerBase(null);
                        update(() => emptyProfile() as Profile);
                        setMessage(`${store.active} wurde zurückgesetzt.`);
                      }
                    }}
                  >
                    Fortschritt von {store.active} löschen
                  </button>
                </section>
                <section className="panel">
                  <h2>Über diese Academy</h2>
                  <p>Version 1 · Deutsch · Zeitzone Europe/Vienna.</p>
                  <p>
                    Alle Kursdaten und Beispiele sind simuliert. Keine Signale,
                    keine spezielle Handelsstrategie, keine Gewinnversprechen.
                    Es werden keine beispielhaften Lernergebnisse als echte
                    Statistik angezeigt.
                  </p>
                </section>
              </div>
              <Sources />
            </>
          )}
          <footer className="academy-footer">
            <span>
              <Icon name="shield" size={15} /> Lernen mit simulierten Daten.
              Ohne Echtgeld.
            </span>
            <span>
              Lokale Profile · Keine Gerätesynchronisierung{" "}
              <button className="text-button" onClick={() => go("settings")}>
                Datensicherung ↗
              </button>
            </span>
          </footer>
        </main>
      </div>
      {term && <TermDialog term={term} onClose={() => setTerm(null)} />}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
function Sources() {
  return (
    <section className="panel sources">
      <div className="eyebrow">PRIMÄRQUELLEN · GEPRÜFT AM 01.10.2026</div>
      <h2>Worauf die Grundlagen aufbauen</h2>
      <p>
        Marktmechanik und Risiken sind anhand dieser offiziellen Quellen
        geprüft. Charts, Zahlenbeispiele, Swing-Regel und Toleranzen sind eigene
        Lehrmodelle. Produktbedingungen und Rechtsregeln sind nicht weltweit
        einheitlich.
      </p>
      {sources.map((s) => (
        <div key={s.url}>
          <a target="_blank" rel="noreferrer" href={s.url}>
            {s.title} ↗
          </a>
          <p className="small muted">{s.note}</p>
        </div>
      ))}
    </section>
  );
}
function TermDialog({ term, onClose }: { term: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const entry = glossary.find((g) => g[0] === term)!;
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className="term-dialog"
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="section-heading">
        <div className="eyebrow">TRADINGLEXIKON</div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Erklärung schließen"
        >
          <Icon name="close" />
        </button>
      </div>
      <h2>{entry[0]}</h2>
      <p>{entry[1]}</p>
      <div className="callout">{entry[2]}</div>
      <button className="primary" onClick={onClose}>
        Verstanden
      </button>
    </dialog>
  );
}
