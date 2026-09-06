"use client";

import Link from "next/link";
import { CardImage } from "@/components/CardImage";
import { SettingsButton } from "@/components/SettingsDialog";
import { useI18n } from "@/i18n/I18nProvider";
import { ruleSections } from "@/i18n/translations";

export default function HowToPlayPage() {
  const { language, t } = useI18n();
  const sections = ruleSections[language];
  return <main className="ravo-felt rules-page relative min-h-screen overflow-hidden px-4 py-6 text-white sm:px-6 sm:py-8">
    <section className="relative z-10 mx-auto w-full max-w-6xl">
      <nav className="mb-8 flex items-center justify-between gap-3"><Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-zinc-300">{t("backHome")}</Link><SettingsButton /></nav>
      <header className="grid gap-8 rounded-[2rem] border border-white/10 bg-black/55 p-6 shadow-2xl md:grid-cols-[1fr_22rem] md:p-8"><div><p className="text-xs font-black uppercase tracking-[.34em] text-zinc-500">{t("learnBluff")}</p><h1 className="mt-4 text-5xl font-black md:text-7xl">{t("howTo")}</h1><p className="mt-5 max-w-2xl font-semibold leading-8 text-zinc-300">{t("rulesIntro")}</p></div><div className="relative hidden min-h-72 md:block"><div className="absolute inset-8 rounded-full bg-[#d4af37]/10 blur-3xl"/><CardImage faceDown className="absolute left-6 top-2 h-64 w-44 -rotate-12 opacity-80"/><CardImage card={{id:"rules-bluff",type:"bluff"}} className="absolute left-28 top-8 h-72 w-48 rotate-8"/></div></header>
      <div className="mt-8 grid gap-4 md:grid-cols-2">{sections.map(([icon,title,lines]) => <article key={title} className="rules-card rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-xl"><div className="flex items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 text-xl font-black text-[#d4af37]">{icon}</span><h2 className="text-2xl font-black">{title}</h2></div><ul className="mt-5 space-y-3">{lines.map((line) => <li key={line} className="flex gap-3 text-sm font-bold leading-6 text-zinc-300"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4af37]/80"/><span>{line}</span></li>)}</ul></article>)}</div>
    </section>
  </main>;
}
