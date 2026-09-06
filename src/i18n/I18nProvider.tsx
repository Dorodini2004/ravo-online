"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { translations, type Language, type TranslationKey } from "./translations";

const STORAGE_KEY = "ravo-language";
type I18nValue = { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string };
const I18nContext = createContext<I18nValue>({ language: "en", setLanguage: () => undefined, t: (key) => translations.en[key] });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore((notify) => {
    window.addEventListener("storage", notify);
    window.addEventListener("ravo-language-change", notify);
    return () => { window.removeEventListener("storage", notify); window.removeEventListener("ravo-language-change", notify); };
  }, () => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "de" || saved === "en") return saved;
    return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
  }, () => "en") as Language;

  function setLanguage(next: Language) {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event("ravo-language-change"));
  }

  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => translations[language][key] }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }

const serverErrorDe: Record<string, string> = {
  "Still connecting to the server. Try again in a moment.": "Verbindung zum Server wird noch hergestellt. Versuche es gleich erneut.",
  "You need at least 2 players to start.": "Mindestens 2 Spieler werden zum Starten benötigt.",
  "Enter a room code.": "Gib einen Raumcode ein.", "Enter your name before creating a room.": "Gib zuerst deinen Namen ein.",
  "Enter your name before joining a room.": "Gib zuerst deinen Namen ein.", "It is not your turn.": "Du bist nicht am Zug.",
  "Only the host can start the game.": "Nur der Host kann das Spiel starten.", "Room not found. Check the code and try again.": "Raum nicht gefunden. Prüfe den Code.",
  "Room not found. Create or join a room first.": "Raum nicht gefunden. Erstelle zuerst einen Raum oder tritt bei.", "That card is not in your hand.": "Diese Karte ist nicht auf deiner Hand.",
  "The game has already started.": "Das Spiel hat bereits begonnen.", "This game has already started.": "Dieses Spiel hat bereits begonnen.",
  "The RAVO window has ended.": "Das RAVO-Fenster ist beendet.", "This room is full.": "Dieser Raum ist voll.",
  "You cannot draw right now.": "Du kannst jetzt keine Karte ziehen.", "You cannot play a card right now.": "Du kannst jetzt keine Karte spielen.",
  "Enter a message before sending.": "Gib vor dem Senden eine Nachricht ein.", "The draw pile is empty.": "Der Nachziehstapel ist leer.",
  "There is no card to challenge right now.": "Gerade kann keine Karte angezweifelt werden.", "This play has already been challenged.": "Dieser Zug wurde bereits angezweifelt.",
  "You cannot call RAVO on your own card.": "Du kannst deine eigene Karte nicht anzweifeln.",
};

export function useLocalizedError(message?: string) {
  const { language } = useI18n();
  return message && language === "de" ? (serverErrorDe[message] ?? message) : message;
}
