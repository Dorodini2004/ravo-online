import Link from "next/link";
import { CardImage } from "@/components/CardImage";

const sections = [
  {
    icon: "◎",
    title: "Goal",
    lines: ["Be the first player to get rid of all cards."],
  },
  {
    icon: "▥",
    title: "Setup",
    lines: ["2-8 players", "8 cards each", "Draw pile", "Face-down discard pile"],
  },
  {
    icon: "↓",
    title: "Start",
    lines: ["Every player draws one card", "Lowest card starts", "Next number becomes active"],
  },
  {
    icon: "↯",
    title: "Turn",
    lines: ["Play exactly one card face-down", "Announce the next number", "Tell the truth or bluff", "Or draw one card"],
  },
  {
    icon: "!",
    title: "RAVO",
    lines: ["Another player may call RAVO", "If the card was a bluff: player who played it draws 2 cards", "If the card was truthful: caller draws 2 cards"],
  },
  {
    icon: "★",
    title: "RAVO Joker",
    lines: ["Counts as any number", "Always truthful"],
  },
  {
    icon: "?",
    title: "BLUFF Card",
    lines: ["If someone incorrectly calls RAVO:", "Caller draws 3 cards", "BLUFF player immediately gets another turn"],
  },
  {
    icon: "♛",
    title: "Win",
    lines: ["First player with zero cards wins."],
  },
];

export default function HowToPlayPage() {
  return (
    <main className="ravo-felt rules-page relative min-h-screen overflow-hidden px-6 py-8 text-white">
      <div className="ravo-atmosphere compact" aria-hidden="true">
        <span className="mask mark-one">◉</span>
        <span className="mask mark-two">?</span>
        <span className="mask mark-three">♠</span>
        <span className="dust dust-one" />
        <span className="dust dust-two" />
      </div>

      <section className="relative z-10 mx-auto w-full max-w-6xl">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-zinc-300 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#d4af37]/40 hover:text-white"
          >
            Back to home
          </Link>
          <p className="text-xs font-black uppercase tracking-[0.34em] text-[#d4af37]">
            Official Rules
          </p>
        </nav>

        <header className="grid gap-8 rounded-[2rem] border border-white/10 bg-black/55 p-6 shadow-[0_32px_110px_rgba(0,0,0,0.65)] backdrop-blur md:grid-cols-[1fr_22rem] md:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.34em] text-zinc-500">
              Learn the bluff
            </p>
            <h1 className="mt-4 text-5xl font-black text-white md:text-7xl">
              How To Play
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-zinc-300">
              RAVO is about hidden information, pressure, and calling the right
              bluff at the right time. Keep your cards moving and make the
              table doubt every play.
            </p>
          </div>

          <div className="relative min-h-72">
            <div className="absolute inset-8 rounded-full bg-[#d4af37]/10 blur-3xl" />
            <CardImage faceDown className="absolute left-6 top-2 h-64 w-44 -rotate-12 opacity-80" />
            <CardImage card={{ id: "rules-bluff", type: "bluff" }} className="absolute left-28 top-8 h-72 w-48 rotate-8" />
          </div>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rules-card rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 text-xl font-black text-[#d4af37]">
                  {section.icon}
                </span>
                <h2 className="text-2xl font-black text-white">{section.title}</h2>
              </div>

              <ul className="mt-5 space-y-3">
                {section.lines.map((line) => (
                  <li key={line} className="flex gap-3 text-sm font-bold leading-6 text-zinc-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4af37]/80" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
