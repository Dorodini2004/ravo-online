export const STORAGE_KEY = "trading-basics-academy-v1";
export const PRACTICE_IDS = [
  "ohlc",
  "structure",
  "phase",
  "zones",
  "orders",
  "risk",
  "size",
  "crv",
  "expectancy",
  "rules",
  "backtest",
  "leverage",
];
export function emptyProfile() {
  return {
    read: [],
    attempts: [],
    errors: [],
    notes: [],
    practice: [],
    sessions: [],
    rules: [],
  };
}
export function emptyStore() {
  return {
    version: 1,
    active: "Patrik",
    profiles: { Patrik: emptyProfile(), Fabian: emptyProfile() },
  };
}
export function viennaDay(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function learningRhythm(sessions) {
  const totals = new Map();
  for (const s of sessions)
    totals.set(s.date, (totals.get(s.date) || 0) + s.seconds);
  const days = [...totals]
    .filter(([, seconds]) => seconds >= 60)
    .map(([date]) => date)
    .sort();
  let streak = days.length ? 1 : 0;
  for (let i = days.length - 1; i > 0; i--) {
    if (Date.parse(days[i]) - Date.parse(days[i - 1]) !== 86400000) break;
    streak++;
  }
  return { days, streak };
}
export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function positionSize({ budget, stop, point, fixed, variable, step }) {
  const values = [budget, stop, point, fixed, variable, step];
  if (
    values.some((v) => typeof v !== "number" || !Number.isFinite(v)) ||
    budget <= 0 ||
    stop <= 0 ||
    point <= 0 ||
    step <= 0 ||
    fixed < 0 ||
    variable < 0
  )
    return {
      error: "Bitte gültige positive Werte eingeben; Kosten dürfen null sein.",
    };
  const per = stop * point + variable;
  const lots = Math.floor((budget - fixed) / per / step + 1e-10);
  const quantity = Number((Math.max(0, lots) * step).toFixed(8));
  if (quantity < step || budget <= fixed)
    return { error: "Keine Position innerhalb dieses Budgets möglich" };
  const risk = stop * point * quantity,
    costs = fixed + variable * quantity,
    total = risk + costs;
  if (!Number.isFinite(total) || total > budget + 1e-7)
    return {
      error: "Werte liegen außerhalb des unterstützten Rechenbereichs.",
    };
  return { quantity, risk, costs, total, unused: budget - total };
}
export function expectancy({ rate, win, loss, cost }) {
  if (
    [rate, win, loss, cost].some(
      (v) => typeof v !== "number" || !Number.isFinite(v),
    ) ||
    rate < 0 ||
    rate > 100 ||
    win < 0 ||
    loss < 0 ||
    cost < 0
  )
    return null;
  return (rate / 100) * win - (1 - rate / 100) * loss - cost;
}
export function reviewError(error, correct, now = Date.now()) {
  if (!correct)
    return { ...error, stage: 0, due: now + 86400000, resolved: false };
  const stage = error.stage + 1;
  return {
    ...error,
    stage,
    due: now + (stage === 1 ? 3 : 7) * 86400000,
    resolved: stage >= 3,
  };
}
export function recordAttempt(profile, attempt, questionMap) {
  const errors = [...profile.errors];
  for (const answer of attempt.answers) {
    if (answer.correct) continue;
    const q = questionMap.get(answer.id);
    if (!q) continue;
    const index = errors.findIndex((e) => e.id === answer.id);
    const entry = {
      id: q.id,
      day: q.day,
      stage: 0,
      due: attempt.at + 86400000,
      resolved: false,
    };
    if (index < 0) errors.push(entry);
    else errors[index] = entry;
  }
  return { ...profile, attempts: [...profile.attempts, attempt], errors };
}
export function confirmedSwings(candles) {
  const out = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i],
      neighbors = [
        candles[i - 2],
        candles[i - 1],
        candles[i + 1],
        candles[i + 2],
      ];
    if (neighbors.every((n) => c.h > n.h)) out.push({ index: i, type: "high" });
    if (neighbors.every((n) => c.l < n.l)) out.push({ index: i, type: "low" });
  }
  return out;
}
export function aggregate(candles, n) {
  const result = [];
  for (let i = 0; i + n <= candles.length; i += n) {
    const a = candles.slice(i, i + n);
    result.push({
      o: a[0].o,
      h: Math.max(...a.map((c) => c.h)),
      l: Math.min(...a.map((c) => c.l)),
      c: a.at(-1).c,
    });
  }
  return result;
}
export function zoneAccepted(low, high, targetLow, targetHigh) {
  return (
    Number.isFinite(low) &&
    Number.isFinite(high) &&
    low < high &&
    high - low >= 1 &&
    high - low <= 5 &&
    Math.abs(low - targetLow) <= 1 &&
    Math.abs(high - targetHigh) <= 1
  );
}
export function validateStore(value, questionIds) {
  const obj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const arr = (v, max) => Array.isArray(v) && v.length <= max;
  const str = (v, max = 10000) => typeof v === "string" && v.length <= max;
  const num = (v, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const keys = (v, allowed) => Object.keys(v).every((k) => allowed.includes(k));
  const date = (v) =>
    str(v, 10) &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (
    !obj(value) ||
    !keys(value, ["version", "active", "profiles"]) ||
    value.version !== 1 ||
    !["Patrik", "Fabian"].includes(value.active) ||
    !obj(value.profiles) ||
    !keys(value.profiles, ["Patrik", "Fabian"])
  )
    throw Error("Ungültiges Sicherungsformat oder unbekannte Version.");
  for (const name of ["Patrik", "Fabian"]) {
    const p = value.profiles[name];
    if (
      !obj(p) ||
      !keys(p, [
        "read",
        "attempts",
        "errors",
        "notes",
        "practice",
        "sessions",
        "rules",
      ])
    )
      throw Error("Profilstruktur ungültig.");
    if (
      !arr(p.read, 14) ||
      new Set(p.read).size !== p.read.length ||
      !p.read.every((n) => Number.isInteger(n) && n >= 1 && n <= 14)
    )
      throw Error("Lektionsfortschritt ungültig.");
    if (
      !arr(p.attempts, 10000) ||
      !p.attempts.every(
        (a) =>
          obj(a) &&
          str(a.id, 100) &&
          str(a.label, 150) &&
          num(a.at, 0, 8640000000000000) &&
          num(a.score, 0, 100) &&
          arr(a.answers, 112) &&
          a.answers.length > 0 &&
          new Set(a.answers.map((x) => x.id)).size === a.answers.length &&
          a.answers.every(
            (x) =>
              obj(x) &&
              questionIds.has(x.id) &&
              str(x.answer, 500) &&
              typeof x.correct === "boolean",
          ) &&
          Math.abs(
            a.score -
              (a.answers.filter((x) => x.correct).length / a.answers.length) *
                100,
          ) < 0.001,
      )
    )
      throw Error("Testergebnisse ungültig.");
    if (
      !arr(p.errors, 500) ||
      new Set(p.errors.map((e) => e.id)).size !== p.errors.length ||
      !p.errors.every(
        (e) =>
          obj(e) &&
          questionIds.has(e.id) &&
          Number.isInteger(e.day) &&
          e.day >= 1 &&
          e.day <= 14 &&
          Number.isInteger(e.stage) &&
          e.stage >= 0 &&
          e.stage <= 3 &&
          num(e.due, 0, 8640000000000000) &&
          typeof e.resolved === "boolean" &&
          e.resolved === (e.stage === 3),
      )
    )
      throw Error("Wiederholungen ungültig.");
    if (
      !arr(p.notes, 5000) ||
      new Set(p.notes.map((n) => n?.id)).size !== p.notes.length ||
      !p.notes.every(
        (n) =>
          obj(n) &&
          str(n.id, 100) &&
          date(n.date) &&
          ["topic", "insight", "mistake", "next"].every((k) => str(n[k])),
      )
    )
      throw Error("Journal ungültig.");
    if (
      !arr(p.practice, 10000) ||
      !p.practice.every(
        (t) =>
          obj(t) &&
          PRACTICE_IDS.includes(t.id) &&
          typeof t.passed === "boolean" &&
          num(t.at, 0, 8640000000000000) &&
          Number.isInteger(t.variant) &&
          num(t.variant, 0, 1000000),
      )
    )
      throw Error("Praxisnachweise ungültig.");
    if (
      !arr(p.sessions, 10000) ||
      !p.sessions.every(
        (s) => obj(s) && date(s.date) && num(s.seconds, 0, 43200),
      )
    )
      throw Error("Lernzeiten ungültig.");
    if (!arr(p.rules, 100) || !p.rules.every((r) => str(r, 1000)))
      throw Error("Regelbuch ungültig.");
  }
  return JSON.parse(JSON.stringify(value));
}
