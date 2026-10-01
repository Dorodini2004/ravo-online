"use client";
import { useState } from "react";
import type { Question } from "./content";
import type { Attempt } from "./types";
import { shuffle } from "./logic.mjs";
import Icon from "./Icon";
export default function Quiz({
  questions,
  label,
  testId,
  onFinish,
  onClose,
}: {
  questions: Question[];
  label: string;
  testId: string;
  onFinish: (a: Attempt) => void;
  onClose: () => void;
}) {
  const [items] = useState(() =>
    questions.map((q) => ({ ...q, options: shuffle(q.options) as string[] })),
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [index, setIndex] = useState(0);
  const q = items[index];
  const answered = Object.keys(answers).length;
  const correct = items.filter((q) => answers[q.id] === q.correct).length;
  const score = (correct / items.length) * 100;
  function submit() {
    if (answered !== items.length || submitted) return;
    setSubmitted(true);
    onFinish({
      id: testId,
      label,
      at: Date.now(),
      score,
      answers: items.map((q) => ({
        id: q.id,
        answer: answers[q.id],
        correct: answers[q.id] === q.correct,
      })),
    });
  }
  return (
    <section className="panel quiz-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">WISSEN AKTIV ABRUFEN</div>
          <h2>{label}</h2>
        </div>
        <button
          className="secondary"
          onClick={() => {
            if (
              submitted ||
              answered === 0 ||
              confirm(
                "Test verlassen? Nicht abgegebene Antworten werden verworfen.",
              )
            )
              onClose();
          }}
        >
          {submitted ? "Zur Übersicht" : "Test verlassen"}
        </button>
      </div>
      {submitted ? (
        <>
          <div className={`quiz-result ${score >= 80 ? "positive" : ""}`}>
            <strong>{Math.round(score)} %</strong>
            <h3>
              {score >= 80
                ? "Wissenstest bestanden"
                : "Hier kannst du weiterlernen"}
            </h3>
            <p>
              {correct} von {items.length} richtig · Bestehensgrenze 80 %
            </p>
            <p className="small">
              Ein Lernnachweis, keine Freigabe für Echtgeldtrading. Falsche
              Antworten wurden für Wiederholungen vorgemerkt.
            </p>
          </div>
          {items.map((item, i) => (
            <div
              className={`feedback ${answers[item.id] === item.correct ? "correct" : "incorrect"}`}
              key={item.id}
            >
              <strong>
                {answers[item.id] === item.correct ? "✓" : "↻"} {i + 1}.{" "}
                {item.prompt}
              </strong>
              <p>
                Deine Antwort: {answers[item.id]}
                <br />
                Richtig: {item.correct}
              </p>
              <p>{item.explanation}</p>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="quiz-progress">
            <span>
              Frage {index + 1} von {items.length}
            </span>
            <span>{answered} beantwortet</span>
          </div>
          <progress value={answered} max={items.length} />
          <h3 className="question-title">{q.prompt}</h3>
          <div className="answer-options">
            {q.options.map((option, i) => (
              <button
                className={answers[q.id] === option ? "selected" : ""}
                aria-pressed={answers[q.id] === option}
                key={option}
                onClick={() => setAnswers({ ...answers, [q.id]: option })}
              >
                <span className="answer-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                {option}
              </button>
            ))}
          </div>
          <div className="actions">
            <button
              className="secondary"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              Zurück
            </button>
            {index < items.length - 1 ? (
              <button className="primary" onClick={() => setIndex(index + 1)}>
                Nächste Frage <Icon name="arrow" />
              </button>
            ) : (
              <button
                className="primary"
                disabled={answered !== items.length}
                onClick={submit}
              >
                Test auswerten <Icon name="check" />
              </button>
            )}
          </div>
          <div className="question-dots">
            {items.map((item, i) => (
              <button
                key={item.id}
                aria-label={`Frage ${i + 1}${answers[item.id] ? ", beantwortet" : ""}`}
                aria-current={i === index ? "step" : undefined}
                className={`${answers[item.id] ? "answered" : ""} ${i === index ? "current" : ""}`}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
