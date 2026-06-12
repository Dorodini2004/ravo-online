import Link from "next/link";
import { CardImage } from "@/components/CardImage";
import { SocketStatus } from "@/components/SocketStatus";

export default function Home() {
  return (
    <main className="ravo-felt ravo-home-scene reference-home relative min-h-screen overflow-hidden px-6 py-8 text-white">
      <div className="ravo-home-background" aria-hidden="true">
        <div className="reference-table" />
        <div className="reference-mask-watermark">◉</div>
        <div className="reference-smoke smoke-one" />
        <div className="reference-smoke smoke-two" />
        <div className="reference-corner-card corner-top-left">
          <CardImage faceDown className="h-full w-full" />
        </div>
        <div className="reference-corner-card corner-bottom-left">
          <CardImage card={{ id: "corner-1", type: "number", value: 1 }} className="h-full w-full" />
        </div>
        <div className="reference-corner-card corner-right">
          <CardImage faceDown className="h-full w-full" />
        </div>
        <div className="reference-corner-card corner-bottom-right">
          <CardImage card={{ id: "corner-10", type: "number", value: 10 }} className="h-full w-full" />
        </div>
      </div>

      <div className="ravo-atmosphere home" aria-hidden="true">
        <span className="mask mark-one">◉</span>
        <span className="mask mark-two">?</span>
        <span className="mask mark-three">♠</span>
        <span className="mask mark-four">◌</span>
        <span className="dust dust-one" />
        <span className="dust dust-two" />
        <span className="dust dust-three" />
      </div>

      <nav className="reference-nav relative z-20 mx-auto flex w-full max-w-[92rem] items-center justify-between">
        <Link href="/" className="reference-brand" aria-label="RAVO Online home">
          <span className="brand-mask">◉</span>
          <span>
            <strong>RAVO</strong>
            <small>ONLINE</small>
          </span>
        </Link>

        <div className="reference-nav-actions">
          <Link href="/how-to-play" className="reference-nav-pill">
            <span>?</span>
            How to play
          </Link>
          <button type="button" className="reference-icon-button" aria-label="Settings">
            ⚙
          </button>
          <button type="button" className="reference-icon-button" aria-label="Profile">
            ♙
          </button>
        </div>
      </nav>

      <section className="reference-hero relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-[92rem] items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="reference-copy relative">
          <div className="ravo-title-aura" aria-hidden="true" />
          <p className="reference-eyebrow">Multiplayer Bluff Card Game</p>

          <h1 className="reference-title">
            RAVO
            <span>ONLINE</span>
          </h1>

          <p className="reference-description">
            Hide the truth, call the bluff, and survive the table. RAVO brings
            your physical card game online with a clean dark table built for
            friends.
          </p>

          <div className="mt-7 max-w-md">
            <SocketStatus />
          </div>

          <div className="reference-actions">
            <Link
              href="/create"
              className="premium-button premium-primary premium-particles home-primary-action reference-primary-action"
            >
              <span className="button-icon">♟</span>
              Create Game
            </Link>

            <Link
              href="/join"
              className="premium-button premium-secondary home-secondary-action reference-secondary-action"
            >
              <span className="button-icon">↪</span>
              Join Game
            </Link>
          </div>
        </div>

        <div className="reference-card-stage">
          <div className="hero-card-spotlight" aria-hidden="true" />
          <div className="hero-card-dust" aria-hidden="true" />

          <CardImage
            faceDown
            className="reference-hero-card reference-card-back"
          />
          <CardImage
            card={{ id: "hero-bluff", type: "bluff" }}
            className="reference-hero-card reference-card-bluff"
          />
          <CardImage
            card={{ id: "hero-joker", type: "ravo-joker" }}
            className="reference-hero-card reference-card-ravo"
          />

          <div className="reference-ready-card">
            <div>
              <p>Live Prototype</p>
              <strong>Ready to play</strong>
            </div>
            <span>◉</span>
          </div>
        </div>
      </section>
    </main>
  );
}
