"use client";
import { useState } from "react";
import Chart, { candlesFor, type Candle } from "./Chart";
import {
  confirmedSwings,
  zoneAccepted,
  positionSize,
  expectancy,
  shuffle,
} from "./logic.mjs";
import Icon from "./Icon";
export const exerciseNames: Record<string, string> = {
  ohlc: "OHLC & Kerzen",
  structure: "Hochs & Tiefs markieren",
  phase: "Marktphasen einordnen",
  zones: "Reaktionsbereiche zeichnen",
  orders: "Orderausführung",
  risk: "Geldrisiko berechnen",
  size: "Positionsgröße berechnen",
  crv: "CRV & Nettoergebnis",
  expectancy: "Erwartungswert",
  rules: "Prozessregeln erkennen",
  backtest: "Backtest überprüfen",
  leverage: "Hebel & Margin",
};
export function makeExercise(id: string, v: number) {
  const n = v % 5,
    stop = 4 + n,
    point = 2,
    qty = 2 + n;
  const bank: Record<
    string,
    { prompt: string; answer: string; explanation: string; options?: string[] }
  > = {
    ohlc: {
      prompt: `Die markierte Kerze hat O ${100 + n}, H ${108 + n}, L ${97 - n}, C ${104 + 2 * n}. Gib zuerst die Körpergröße und dann die gesamte Spanne in Punkten ein (mit / getrennt).`,
      answer: `${4 + n} / ${11 + 2 * n}`,
      explanation: `Körper = |Schluss−Eröffnung| = ${4 + n} Punkte. Spanne = Hoch−Tief = ${11 + 2 * n} Punkte. Die Dochte ergänzen den Körper.`,
    },
    phase: {
      prompt: "Ordne den sichtbaren Ausschnitt anhand der Hochs und Tiefs ein.",
      answer: ["Aufwärtsphase", "Abwärtsphase", "Seitwärtsphase"][v % 3],
      options: ["Aufwärtsphase", "Abwärtsphase", "Seitwärtsphase"],
      explanation: [
        "Die aufeinanderfolgenden Hochs und Tiefs steigen. Das beschreibt diesen Ausschnitt, keine Prognose.",
        "Die Hochs und Tiefs fallen. Ein Abwärtstrend sagt nicht sicher die nächste Kerze voraus.",
        "Die Schwankungen bleiben in einem überlappenden Bereich ohne gerichtete Folge.",
      ][v % 3],
    },
    orders:
      v % 2 === 0
        ? {
            prompt: `Long ab ${100 + n}, Verkaufsstop ${95 + n}. Der nächste handelbare Kurs liegt nach einer Lücke bei ${92 + n}. Welche Aussage stimmt?`,
            answer: "Der Verlust kann größer als geplant sein.",
            options: [
              "Der Verlust kann größer als geplant sein.",
              "Der Stop garantiert den geplanten Preis.",
              "Margin ersetzt den Ausstieg.",
            ],
            explanation: `Eine Stop-Market-Order kann erst beim verfügbaren Preis ausgeführt werden: hier 8 statt 5 Punkte Verlust. Anbieterbedingungen beachten.`,
          }
        : {
            prompt: `Ask ${100 + n}. Du willst höchstens ${98 + n} bezahlen. Welche Order passt, obwohl sie unausgeführt bleiben kann?`,
            answer: `Kauf-Limit ${98 + n}`,
            options: [`Kauf-Limit ${98 + n}`, "Market-Kauf", "Verkaufsstop"],
            explanation:
              "Ein Kauflimit setzt eine Preisobergrenze. Es garantiert keine Ausführung. Stop-Limit kann nach Auslösung ebenfalls ungefüllt bleiben.",
          },
    risk: {
      prompt: `Stop-Abstand ${stop} Punkte, Geldwert ${point} €/Punkt/Einheit, Menge ${qty}. Geldrisiko vor Kosten in €?`,
      answer: String(stop * point * qty),
      explanation: `${stop} × ${point} × ${qty} = ${stop * point * qty} €. Stop-Ausführung und tatsächlicher Verlust können abweichen.`,
    },
    size: {
      prompt: `Budget ${30 + n * 10} €, Stop ${stop} Punkte, Wert 2 €/Punkt/Einheit, fixe Gesamtkosten 2 €, variable Gesamtkosten 1 €/Einheit, Stückelung 1. Größte passende Menge?`,
      answer: String(Math.floor((28 + n * 10) / (stop * 2 + 1))),
      explanation: `(${30 + n * 10}−2) / (${stop}×2+1) = ${((28 + n * 10) / (stop * 2 + 1)).toFixed(2)}. Immer auf ganze Einheiten abrunden. Fixkosten fallen einmal an.`,
    },
    crv: {
      prompt: `Geplantes Bruttoziel ${60 + n * 20} €, geplantes Risiko ${30 + n * 10} €, Gesamtkosten ${4 + n} €. Gib Brutto-CRV (nur Zahl) und Nettoergebnis beim Ziel mit / getrennt ein.`,
      answer: `2 / ${56 + n * 19}`,
      explanation: `Ziel/Risiko = 2. Netto beim Ziel = ${60 + n * 20}−${4 + n} = ${56 + n * 19} €. Ein CRV von 2 allein beweist keinen Vorteil.`,
    },
    expectancy: {
      prompt: `Trefferquote ${40 + n * 5} %, mittlerer Bruttogewinn 100 €, mittlerer Bruttoverlust 50 €, Kosten 5 € je Versuch. Netto-Erwartungswert in €?`,
      answer: String(((40 + n * 5) / 100) * 150 - 55),
      explanation: `${(40 + n * 5) / 100}×100 − ${1 - (40 + n * 5) / 100}×50 − 5 = ${(((40 + n * 5) / 100) * 150 - 55).toFixed(2)} €. Kosten werden einmal abgezogen.`,
    },
    rules:
      v % 2 === 0
        ? {
            prompt:
              "Nach zwei Verlusten verdoppelt Fabian spontan die Menge und gewinnt. Wie bewertest du das?",
            answer: "Regelverstoß trotz Gewinn",
            options: [
              "Regelverstoß trotz Gewinn",
              "Guter Prozess, weil Gewinn",
              "Ein Gewinn löscht frühere Fehler",
            ],
            explanation:
              "Spontane Risikoerhöhung nach Verlusten ist Revenge Trading. Der Gewinn rechtfertigt den Prozess nicht.",
          }
        : {
            prompt:
              "Patrik lässt eine Simulation aus, weil der Punktwert unbekannt ist. Wie bewertest du das?",
            answer: "Bewusste regelkonforme Entscheidung",
            options: [
              "Bewusste regelkonforme Entscheidung",
              "Verpasster garantierter Gewinn",
              "Fehler, man muss immer handeln",
            ],
            explanation:
              "Ohne Punktwert lässt sich das Geldrisiko nicht bestimmen. Nicht-Handeln kann die saubere Entscheidung sein.",
          },
    backtest:
      v % 2 === 0
        ? {
            prompt:
              "Ein Backtest nutzt ein Swing-Hoch als Einstieg, bevor die beiden rechten Bestätigungskerzen geschlossen sind. Was ist der Fehler?",
            answer: "Look-ahead-Bias: Zukunftswissen",
            options: [
              "Look-ahead-Bias: Zukunftswissen",
              "Zu viele dokumentierte Verluste",
              "Zu ehrliche Gebühren",
            ],
            explanation:
              "Die Bestätigung war zum Entscheidungszeitpunkt noch unbekannt. Spätere Information darf die damalige Entscheidung nicht beeinflussen.",
          }
        : {
            prompt:
              "Ein Test zeigt nur die besten 20 aus 100 Versuchen und ignoriert Gebühren. Was fehlt?",
            answer: "Alle Fälle und konsistente Kosten",
            options: [
              "Alle Fälle und konsistente Kosten",
              "Nur noch mehr Gewinner",
              "Ein größerer Chart",
            ],
            explanation:
              "Auswahl nach Ergebnis verzerrt die Stichprobe. Jeder regelkonforme Fall und seine Kosten müssen enthalten sein.",
          },
    leverage: {
      prompt: `Eigenkapital 1.000 €, Positionswert ${5000 + n * 1000} €, Margin 200 €. Gib den Hebel (nur Zahl) ein. Ist die Margin ein Verlustdeckel? Antworte Zahl / ja oder nein.`,
      answer: `${5 + n} / nein`,
      explanation: `${5000 + n * 1000}/1.000 = ${5 + n}:1. Die 200 € Margin sind eine Sicherheit, kein maximaler Verlust.`,
    },
  };
  if (id === "orders" && v % 4 === 2)
    return {
      prompt: `Du willst nach Auslösung bei ${105 + n} kaufen, aber höchstens ${106 + n} bezahlen. Welcher Typ verbindet beide Bedingungen?`,
      answer: "Kauf-Stop-Limit",
      options: ["Kauf-Stop-Limit", "Market-Kauf", "Verkauf-Limit"],
      explanation:
        "Stop-Limit wird nach Auslösung zu einem Limit-Auftrag. Bei einem Sprung über das Kauflimit kann die Ausführung ausbleiben.",
    };
  if (id === "orders" && v % 4 === 3)
    return {
      prompt: `Du hältst eine Long-Position. Unter ${95 + n} soll ein Verkaufsauftrag zum dann verfügbaren Preis ausgelöst werden. Welcher Typ passt?`,
      answer: "Verkaufsstop (Stop-Market)",
      options: [
        "Verkaufsstop (Stop-Market)",
        "Kauf-Limit",
        "Take-Profit oberhalb des Kurses",
      ],
      explanation:
        "Ein Verkaufsstop unter dem Kurs wird bei Auslösung zur Market-Order. Der Ausführungspreis ist nicht garantiert; ein Verlust kann größer werden als geplant.",
    };
  return bank[id];
}
function normalized(v: string) {
  return v.toLowerCase().replaceAll(",", ".").replace(/\s/g, "");
}
function answerMatches(value: string, expected: string) {
  const a = normalized(value).split("/"),
    b = normalized(expected).split("/");
  return (
    a.length === b.length &&
    a.every(
      (s, i) =>
        s !== "" &&
        (s === b[i] ||
          (!Number.isNaN(Number(s)) &&
            !Number.isNaN(Number(b[i])) &&
            Math.abs(Number(s) - Number(b[i])) < 0.005)),
    )
  );
}
export default function Exercises({
  onResult,
  initial = "ohlc",
  exam = false,
}: {
  onResult: (id: string, passed: boolean, variant: number) => void;
  initial?: string;
  exam?: boolean;
}) {
  const [id, setId] = useState(initial);
  const [variant, setVariant] = useState(0);
  const [choiceOrder, setChoiceOrder] = useState(
    () => shuffle([0, 1, 2]) as number[],
  );
  const [answer, setAnswer] = useState("");
  const [marks, setMarks] = useState<number[]>([]);
  const [zone, setZone] = useState<[number, number]>([98, 103]);
  const [result, setResult] = useState<{ pass: boolean; text: string } | null>(
    null,
  );
  const ex = makeExercise(id, variant);
  const offset = (variant % 5) * 3;
  const resistance = variant % 2 === 1;
  const targetLow = (resistance ? 111 : 99) + offset,
    targetHigh = targetLow + 2;
  const markHigh = variant % 4 < 2;
  const swingLabel = ["HH", "LH", "HL", "LL"][variant % 4];
  const series =
    id === "zones"
      ? Array.from({ length: 18 }, (_, i) => {
          const lows = [
            103, 101, 99, 102, 105, 107, 104, 101, 100, 103, 106, 108, 105, 102,
            101, 104, 107, 109,
          ];
          const l = lows[i] + offset;
          return { o: l + 2, c: l + 3, h: l + 4, l };
        })
      : id === "ohlc"
        ? [
            {
              o: 100 + (variant % 5),
              h: 108 + (variant % 5),
              l: 97 - (variant % 5),
              c: 104 + 2 * (variant % 5),
            },
          ]
        : candlesFor(
            variant % 5,
            id === "phase"
              ? ["up", "down", "side"][variant % 3]
              : variant % 2 === 0
                ? "up"
                : "down",
          ).slice(variant % 3);
  function reset(next = id) {
    setId(next);
    setChoiceOrder(shuffle([0, 1, 2]) as number[]);
    setAnswer("");
    setMarks([]);
    setResult(null);
    setZone([98 + offset, 103 + offset]);
  }
  function check() {
    let pass = false,
      text = "";
    if (id === "structure") {
      const expected = confirmedSwings(series)
        .filter((s: { type: string }) => s.type === (markHigh ? "high" : "low"))
        .map((s: { index: number }) => s.index);
      pass =
        marks.length === expected.length &&
        marks.every((i) => expected.includes(i)) &&
        answer === swingLabel;
      text = `Nach der Regel mit je zwei linken und rechten geschlossenen Kerzen sind ${markHigh ? "Hochs" : "Tiefs"} bei Kerzen ${expected.map((i: number) => i + 1).join(", ")} bestätigt. Der letzte bestätigte Punkt ist gegenüber dem vorherigen ${["ein höheres Hoch (HH)", "ein tieferes Hoch (LH)", "ein höheres Tief (HL)", "ein tieferes Tief (LL)"][variant % 4]}. Am rechten Rand gibt es keine vorweggenommene Bestätigung.`;
    } else if (id === "zones") {
      pass = zoneAccepted(zone[0], zone[1], targetLow, targetHigh);
      text = `Die ${resistance ? "Hochs" : "Tiefs"} bei ${targetLow}, ${targetLow + 1} und ${targetHigh} begründen z. B. ${targetLow}–${targetHigh} oder ${targetLow - 1}–${targetHigh + 1}. Akzeptiert: jede Grenze ±1 Punkt um ${targetLow}/${targetHigh}, Breite 1–5. Andere Zonen können begründbar sein; diese Aufgabe bewertet den ${resistance ? "oberen" : "unteren"} Reaktionsbereich. Eine Zone garantiert keine zukünftige Reaktion.`;
    } else {
      pass = answerMatches(answer, ex.answer);
      text = `${ex.explanation} Musterantwort: ${ex.answer}`;
    }
    setResult({ pass, text });
    onResult(id, pass, variant);
  }
  return (
    <div className="exercise-layout">
      <div className="exercise-picker">
        {Object.entries(exerciseNames).map(([key, name], i) => (
          <button
            key={key}
            className={id === key ? "selected" : ""}
            onClick={() => reset(key)}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {name}
          </button>
        ))}
      </div>
      <section className="panel exercise-main">
        <div className="eyebrow">
          {exam ? "PRAKTISCHE PRÜFUNG" : "DEIN ÜBUNGSRAUM"} · VARIANTE{" "}
          {variant + 1}
        </div>
        <h2>{exerciseNames[id]}</h2>
        <p>
          {id === "structure"
            ? `Markiere alle bestätigten Swing-${markHigh ? "Hochs" : "Tiefs"}. Regel: strikt ${markHigh ? "höher" : "niedriger"} als je zwei linke und rechte geschlossene Kerzen. Erst danach bestätigt. Vergleiche außerdem den letzten bestätigten Punkt mit dem vorherigen: HH, LH, HL oder LL?`
            : id === "zones"
              ? `Zeichne den ${resistance ? "oberen Widerstandsbereich um die Hochs" : "unteren Unterstützungsbereich um die Tiefs"}. Ziehe senkrecht im Chart oder gib die Grenzen ein. Toleranz: jede Grenze ±1 Punkt um die äußeren beobachteten Reaktionspreise; Breite 1–5 Punkte. Über „Neue Aufgabe“ übst du abwechselnd beide Bereichstypen.`
              : ex.prompt}
        </p>
        {["ohlc", "structure", "phase", "zones"].includes(id) && (
          <Chart
            candles={series as Candle[]}
            marking={id === "structure"}
            marks={marks}
            onMark={
              id === "structure" && !result
                ? (i) =>
                    setMarks((m) =>
                      m.includes(i) ? m.filter((x) => x !== i) : [...m, i],
                    )
                : undefined
            }
            zone={id === "zones" ? zone : undefined}
            onZone={id === "zones" && !result ? setZone : undefined}
          />
        )}
        {id === "zones" ? (
          <div className="form-grid">
            <label>
              Untergrenze (Punkte)
              <input
                type="number"
                step="0.5"
                value={zone[0]}
                disabled={!!result}
                onChange={(e) => setZone([Number(e.target.value), zone[1]])}
              />
            </label>
            <label>
              Obergrenze (Punkte)
              <input
                type="number"
                step="0.5"
                value={zone[1]}
                disabled={!!result}
                onChange={(e) => setZone([zone[0], Number(e.target.value)])}
              />
            </label>
          </div>
        ) : id === "structure" ? (
          <>
            <p className="small">
              Ausgewählt:{" "}
              {marks.length
                ? marks
                    .map((i) => i + 1)
                    .sort((a, b) => a - b)
                    .join(", ")
                : "noch keine Kerze"}
              . Per Klick, Touch oder Tab + Enter markieren.
            </p>
            <label>
              Letzter bestätigter Punkt im Vergleich
              <select
                value={answer}
                disabled={!!result}
                onChange={(e) => setAnswer(e.target.value)}
              >
                <option value="">Bitte wählen</option>
                <option value="HH">HH · höheres Hoch</option>
                <option value="LH">LH · tieferes Hoch</option>
                <option value="HL">HL · höheres Tief</option>
                <option value="LL">LL · tieferes Tief</option>
              </select>
            </label>
          </>
        ) : ex.options ? (
          <div className="answer-options">
            {choiceOrder
              .map((i) => ex.options![i])
              .map((option) => (
                <button
                  key={option}
                  disabled={!!result}
                  aria-pressed={answer === option}
                  className={answer === option ? "selected" : ""}
                  onClick={() => setAnswer(option)}
                >
                  {option}
                </button>
              ))}
          </div>
        ) : (
          <label>
            Deine Antwort
            <input
              value={answer}
              disabled={!!result}
              placeholder="Wert eingeben"
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && answer && !result) check();
              }}
            />
          </label>
        )}
        {result && (
          <div
            className={`feedback ${result.pass ? "correct" : "incorrect"}`}
            role="status"
          >
            <strong>
              {result.pass
                ? "✓ Nachvollziehbar gelöst"
                : "↻ Noch einmal gemeinsam ansehen"}
            </strong>
            <p>{result.text}</p>
          </div>
        )}
        <div className="actions">
          <button
            className="primary"
            disabled={
              !!result ||
              (!["structure", "zones"].includes(id) && !answer.trim())
            }
            onClick={check}
          >
            Antwort prüfen <Icon name="check" />
          </button>
          <button
            className="secondary"
            onClick={() => {
              setVariant((v) => v + 1);
              reset();
            }}
          >
            Neue Aufgabe <Icon name="repeat" />
          </button>
        </div>
        <p className="small muted">
          Alle Daten und Instrumente sind simuliert. Rechenergebnisse sind
          Planwerte, keine Ausführungsgarantie.
        </p>
      </section>
    </div>
  );
}
export function Calculators() {
  const [inputs, setInputs] = useState({
    budget: "50",
    stop: "8",
    point: "2",
    fixed: "2",
    variable: "1",
    step: "1",
  });
  const [ev, setEv] = useState({
    rate: "40",
    win: "100",
    loss: "50",
    cost: "5",
  });
  const parsed = Object.fromEntries(
    Object.entries(inputs).map(([k, v]) => [
      k,
      v.trim() === "" ? NaN : Number(v.replace(",", ".")),
    ]),
  ) as Record<keyof typeof inputs, number>;
  const result = positionSize(parsed);
  const e = expectancy(
    Object.fromEntries(
      Object.entries(ev).map(([k, v]) => [
        k,
        v.trim() === "" ? NaN : Number(v.replace(",", ".")),
      ]),
    ) as Record<keyof typeof ev, number>,
  );
  const labels = {
    budget: "Übungsbudget (€)",
    stop: "Stop-Abstand (Punkte)",
    point: "Wert (€/Punkt/Einheit)",
    fixed: "Fixe Gesamtkosten (€)",
    variable: "Kosten je Einheit (€)",
    step: "Erlaubte Stückelung",
  };
  return (
    <div className="two-col calculators">
      <section className="panel">
        <div className="eyebrow">LINEARES ÜBUNGSINSTRUMENT</div>
        <h2>Positionsgrößen-Rechner</h2>
        <div className="form-grid">
          {Object.entries(inputs).map(([key, val]) => (
            <label key={key}>
              {labels[key as keyof typeof labels]}
              <input
                inputMode="decimal"
                value={val}
                onChange={(e) =>
                  setInputs({ ...inputs, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <div className="callout" aria-live="polite">
          {result.error ? (
            <strong>{result.error}</strong>
          ) : (
            <>
              <strong>{result.quantity} Einheiten</strong>
              <p>
                Risiko vor Kosten: {result.risk?.toFixed(2)} €<br />
                Kosten: {result.costs?.toFixed(2)} €<br />
                Geplant gesamt: {result.total?.toFixed(2)} €<br />
                Budgetrest: {result.unused?.toFixed(2)} €
              </p>
            </>
          )}
        </div>
        <p className="small">
          Menge = (Budget − Fixkosten) / (Stop × Punktwert + Kosten je Einheit),
          auf die Stückelung abgerundet. Stückelung ist hier zugleich
          Mindestmenge. Kosten gelten für den gesamten Ein- und Ausstieg.
          Slippage kann Verluste vergrößern.
        </p>
      </section>
      <section className="panel">
        <div className="eyebrow">DURCHSCHNITT IM MODELL</div>
        <h2>Erwartungswert-Rechner</h2>
        <div className="form-grid">
          {Object.entries(ev).map(([key, val]) => (
            <label key={key}>
              {
                {
                  rate: "Trefferquote (%)",
                  win: "Ø Bruttogewinn (€)",
                  loss: "Ø Bruttoverlust (€)",
                  cost: "Ø Kosten je Versuch (€)",
                }[key]
              }
              <input
                inputMode="decimal"
                value={val}
                onChange={(e) => setEv({ ...ev, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="callout" aria-live="polite">
          <strong>
            {e === null
              ? "Bitte gültige Werte eingeben."
              : `${e.toFixed(2)} € netto / Versuch`}
          </strong>
        </div>
        <p>Trefferquote × Gewinn − Verlustquote × Verlust − Kosten.</p>
        <p className="small">
          Quote 0–100 %, übrige Werte ≥ 0. Dies ist eine Modellrechnung, keine
          Prognose. Bereits enthaltenen Spread nicht nochmals erfassen. Ein
          hoher Erwartungswert aus wenigen Versuchen kann Zufall sein.
        </p>
      </section>
    </div>
  );
}
