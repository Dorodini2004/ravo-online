"use client";
import Link from "next/link";
import { JoinRoomForm } from "@/components/JoinRoomForm";
import { SettingsButton } from "@/components/SettingsDialog";
import { useI18n } from "@/i18n/I18nProvider";

export default function JoinGamePage() {
  const { t } = useI18n();
  return (
    <main className="ravo-felt relative min-h-screen overflow-hidden px-6 py-8 text-white">
      <div className="ravo-atmosphere compact" aria-hidden="true">
        <span className="mask mark-one">◉</span>
        <span className="mask mark-two">?</span>
        <span className="mask mark-three">♠</span>
        <span className="card-silhouette card-one" />
        <span className="card-silhouette card-two" />
        <span className="dust dust-one" />
        <span className="dust dust-three" />
      </div>

      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute left-[18%] bottom-[14%] h-80 w-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute right-[12%] top-[18%] h-96 w-96 rounded-full bg-[#d4af37]/10 blur-3xl" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col justify-center">
        <div className="mb-8 flex items-center justify-between"><Link
          href="/"
          className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-zinc-300 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-black"
        >
          {t("backHome")}
        </Link><SettingsButton /></div>

        <JoinRoomForm />
      </section>
    </main>
  );
}
