"use client";
import { useRef, useState } from "react";
import { CardImage } from "./CardImage";
import { SettingsButton } from "./SettingsDialog";
import { LocalCamera } from "./LocalCamera";
import { useI18n } from "@/i18n/I18nProvider";
import type { Card, ChatMessage, Room } from "@/types/room";

type Props = {
  room: Room; hand: Card[]; playerId: string; messages: ChatMessage[]; error?: string;
  canPlay: boolean; canDraw: boolean; canCall: boolean; countdown: number;
  onPlay: (id: string) => void; onDraw: () => void; onCall: () => void;
  onBonus: () => void; onAgain: () => void; onChat: (text: string) => void;
  camera: MediaStream | null; mic: MediaStream | null; onCamera: () => void; onMic: () => void;
};
export function MobileGame(p: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const gesture = useRef({ x: 0, y: 0, moved: false });
  const actionLock = useRef(0);
  const selectedCard = p.hand.find(card => card.id === selected);
  function play() {
    if (!selectedCard || !p.canPlay || Date.now() < actionLock.current) return;
    actionLock.current = Date.now() + 700;
    p.onPlay(selectedCard.id); setSelected(null);
  }
  return <main className="mobile-game">
    <header><strong>RAVO · {p.room.code}</strong><SettingsButton /></header>
    <section className="mobile-status"><strong>{t("nextNumber")}: {p.room.expectedNumber}</strong><span>{t("turn")}: {p.room.players.find(player => player.id === p.room.currentTurnPlayerId)?.name ?? "—"}</span></section>
    <section className="mobile-reveal"><CardImage faceDown={p.room.pendingPlayedCard || !p.room.lastRevealedCard} card={p.room.lastRevealedCard ?? undefined} /><div><strong>{p.room.pendingPlayedCard ? t("faceDown") : t("revealed")}</strong><p>{p.room.players.find(player => player.id === p.room.lastPlayedBy)?.name}</p>{p.room.status === "challenge" ? <p role="timer">{t("ravoTime")}: {p.countdown}</p> : null}</div></section>
    <div className="mobile-actions"><button disabled={!p.canCall} onClick={p.onCall}>RAVO!</button><button disabled={!p.canDraw} onClick={p.onDraw}>{t("drawCard")}</button></div>
    {p.error ? <p role="alert">{p.error}</p> : null}
    <section className="mobile-hand"><h2>{t("myHand")} · {p.hand.length}</h2><p>{t("selectCard")}</p>
      <div className="mobile-hand-scroll" onPointerDown={e => { gesture.current = { x: e.clientX, y: e.clientY, moved: false }; }} onPointerMove={e => { if (Math.hypot(e.clientX - gesture.current.x, e.clientY - gesture.current.y) > 8) gesture.current.moved = true; }} onPointerCancel={() => { gesture.current.moved = true; }}>
        {p.hand.map(card => <button key={card.id} aria-pressed={selected === card.id} aria-label={`${t("play")} ${card.type === "number" ? card.value : card.type}`} onClick={() => { if (!gesture.current.moved) setSelected(card.id); }}><CardImage card={card}/></button>)}
      </div>
      <div className="mobile-actions"><button disabled={!selectedCard || !p.canPlay} onClick={play}>{t("play")}{selectedCard?.type === "number" ? ` ${selectedCard.value}` : ""}</button>{p.room.status === "bluff-extra" && p.room.bluffExtraPlayerId === p.playerId ? <button onClick={p.onBonus}>{t("endBonus")}</button> : null}</div>
    </section>
    <section className="mobile-opponents">{p.room.players.filter(player => player.id !== p.playerId).map(player => <div key={player.id}><strong>{player.name}</strong><span>{player.cardCount} {t("cards")}</span></div>)}</section>
    <details><summary>{t("chat")}</summary><div className="mobile-messages">{p.messages.map(message => <p key={message.id}><strong>{message.playerName}: </strong>{message.message}</p>)}</div><form onSubmit={event => { event.preventDefault(); if (draft.trim()) { p.onChat(draft.trim()); setDraft(""); } }}><input aria-label={t("typeMessage")} placeholder={t("typeMessage")} value={draft} onChange={event => setDraft(event.target.value)}/><button disabled={!draft.trim()}>{t("send")}</button></form></details>
    <details><summary>{t("media")}</summary><LocalCamera cameraStream={p.camera} isCameraOn={!!p.camera} isMicOn={!!p.mic}/><div className="mobile-actions"><button onClick={p.onCamera}>{t("camera")}: {t(p.camera ? "on" : "off")}</button><button onClick={p.onMic}>{t("microphone")}: {t(p.mic ? "on" : "off")}</button></div></details>
    {p.room.status === "finished" ? <section><h2>{p.room.players.find(player => player.id === p.room.winnerId)?.name} {t("wins")}</h2><button onClick={p.onAgain}>{t("playAgain")}</button></section> : null}
    {p.room.status === "draw-pile-empty" ? <p role="alert">{t("gamePaused")}: {t("penaltyShortage")}</p> : null}
  </main>;
}
