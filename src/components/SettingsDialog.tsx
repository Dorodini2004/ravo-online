"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

export function SettingsButton({ className = "reference-icon-button" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return <><button type="button" className={className} aria-label={t("settings")} title={t("settings")} onClick={() => setOpen(true)}>⚙</button>{open ? <SettingsDialog onClose={() => setOpen(false)} /> : null}</>;
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { language, setLanguage, t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll<HTMLElement>('button,[href],input,select,[tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const first = items[0], last = items.at(-1)!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [onClose]);

  return <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="w-full max-w-md rounded-3xl border border-[#d4af37]/30 bg-zinc-950 p-6 text-white shadow-2xl">
      <div className="flex items-center justify-between"><h2 id="settings-title" className="text-2xl font-black">{t("settings")}</h2><button ref={closeRef} type="button" onClick={onClose} className="rounded-xl border border-white/15 px-3 py-2" aria-label={t("close")} title={t("close")}>×</button></div>
      <fieldset className="mt-6"><legend className="text-sm font-black uppercase tracking-widest text-[#d4af37]">{t("language")}</legend><div className="mt-3 grid grid-cols-2 gap-3">{(["de","en"] as const).map((code) => <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)} className={`rounded-xl border p-3 font-bold ${language === code ? "border-[#d4af37] bg-[#d4af37]/15" : "border-white/10 bg-white/5"}`}>{t(code === "de" ? "german" : "english")}</button>)}</div></fieldset>
      <p className="mt-4 text-sm text-zinc-400">{t("saveLanguage")}</p>
    </div>
  </div>;
}
