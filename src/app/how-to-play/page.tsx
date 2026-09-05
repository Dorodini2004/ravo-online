import Link from "next/link";
import { CardImage } from "@/components/CardImage";

const sections = [
  {
    icon: "◎",
    title: "Goal & Setup",
    lines: [
      "RAVO is played by 2-8 players.",
      "Every player receives 8 cards.",
      "The 90-card deck contains nine copies of each number from 1 to 9, 6 RAVO Jokers, and 3 BLUFF cards.",
      "Be the first player to empty your hand.",
    ],
  },
  {
    icon: "↓",
    title: "Starting the Game",
    lines: [
      "The server randomly chooses the starting player. Everyone has the same chance.",
      "No extra cards are drawn to choose who starts, and the lowest card does not matter.",
      "The first required number is always 1.",
      "Play continues from the chosen starting player in the existing seating order.",
      "A new starting player is chosen every time a new game begins, including after Play Again.",
    ],
  },
  {
    icon: "▥",
    title: "Number Sequence",
    lines: [
      "The required number follows the fixed sequence 1 → 2 → ... → 9 → 1.",
      "It advances exactly once after each completed turn, including a draw or a resolved RAVO call.",
      "BLUFF bonus cards belong to the same turn, so the number advances only after the entire bonus ends.",
    ],
  },
  {
    icon: "↯",
    title: "Your Turn",
    lines: [
      "Either play any one hand card face-down or draw one card and end your turn.",
      "When you play, your claim is automatically the current required number.",
      "You may deliberately play a different number card. That is a legal bluff.",
    ],
  },
  {
    icon: "!",
    title: "RAVO Call",
    lines: [
      "Other players have 5 seconds to challenge the face-down card. You cannot challenge your own card.",
      "If the number matches the claim, the caller was wrong and draws 2 cards.",
      "If the number does not match, the player was bluffing and draws 2 cards.",
      "The played card remains on the discard pile in either case.",
      "Without a RAVO call, even a false number receives no penalty.",
      "The first valid call received by the server decides the challenge; later calls are rejected.",
    ],
  },
  {
    icon: "★",
    title: "RAVO Joker",
    lines: [
      "A RAVO Joker counts as every required number and is always truthful.",
      "A player who challenges a Joker draws 2 cards.",
    ],
  },
  {
    icon: "?",
    title: "BLUFF Card",
    lines: [
      "A BLUFF card may be played at any required number.",
      "Without a RAVO call, it gives no bonus and the turn ends normally.",
      "If challenged, the player may discard up to 2 more cards face-down. The caller receives no penalty.",
      "Bonus cards may be any cards. They cannot be challenged and trigger no additional card effects.",
      "All bonus cards are part of the same turn. The player may stop after 0, 1, or 2 bonus cards.",
    ],
  },
  {
    icon: "♛",
    title: "Winning",
    lines: [
      "After a normal last card, victory is checked only after the RAVO window and any call are fully resolved.",
      "An honest last number or Joker still wins after an incorrect call.",
      "If a false last number is caught, the player draws 2 cards and the game continues.",
      "A last BLUFF card wins even when challenged. Emptying your hand with the first bonus card also wins immediately.",
    ],
  },
  {
    icon: "↻",
    title: "Reshuffling",
    lines: [
      "When the draw pile runs out, keep the top discard card on the table.",
      "Shuffle all older discarded cards and use them as the new draw pile.",
      "If too few recyclable cards remain to pay a complete penalty, the game pauses instead of cancelling part of the penalty or awarding a win.",
    ],
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
