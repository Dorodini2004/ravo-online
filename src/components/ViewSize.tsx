"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/I18nProvider";
let fallback = "auto";
const subscribe = (notify: () => void) => {
  window.addEventListener("ravo-view-size", notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener("ravo-view-size", notify); window.removeEventListener("storage", notify); };
};
function snapshot() { try { const value = localStorage.getItem("ravo-view-size"); return value && ["auto", "compact", "large"].includes(value) ? value : fallback; } catch { return fallback; } }
export function ViewSizeSync() {
  const size = useSyncExternalStore(subscribe, snapshot, () => "auto");
  useEffect(() => { document.documentElement.dataset.viewSize = size; }, [size]);
  return null;
}
export function ViewSizePicker() {
  const { t } = useI18n();
  const size = useSyncExternalStore(subscribe, snapshot, () => "auto");
  return <fieldset className="view-size-picker"><legend>{t("viewSize")}</legend>{(["auto", "compact", "large"] as const).map(value => <button type="button" key={value} aria-pressed={size === value} onClick={() => { fallback = value; try { localStorage.setItem("ravo-view-size", value); } catch { /* Keep the session choice. */ } window.dispatchEvent(new Event("ravo-view-size")); }}>{t(value)}</button>)}</fieldset>;
}
