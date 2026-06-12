"use client";

import { useState } from "react";
import { CardImage } from "@/components/CardImage";
import type { Room } from "@/types/room";

type RoomPanelProps = {
  currentPlayerId: string;
  error?: string;
  onStartGame: () => void;
  room: Room;
};

export function RoomPanel({
  currentPlayerId,
  error,
  onStartGame,
  room,
}: RoomPanelProps) {
  const [copyText, setCopyText] = useState("Copy Code");
  const isHost = room.hostId === currentPlayerId;

  async function handleCopyCode() {
    await navigator.clipboard.writeText(room.code);
    setCopyText("Copied!");

    window.setTimeout(() => {
      setCopyText("Copy Code");
    }, 2000);
  }

  return (
    <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/90 p-5 shadow-[0_32px_110px_rgba(0,0,0,0.65)] backdrop-blur sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="relative min-h-88 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/70 shadow-[inset_0_0_80px_rgba(255,255,255,0.04)]">
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4af37]/10 blur-3xl" />
        <CardImage
          faceDown
          className="absolute left-8 top-8 h-72 w-48 -rotate-12 opacity-80"
        />
        <CardImage
          card={{ id: "lobby-joker", type: "ravo-joker" }}
          className="absolute left-28 top-20 h-80 w-52 rotate-6 shadow-[0_30px_90px_rgba(0,0,0,0.75)]"
        />

        <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-black/75 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4af37]">
            Room Code
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-4xl font-black tracking-[0.08em] text-white">
              {room.code}
            </p>
            <button
              type="button"
              onClick={handleCopyCode}
              className={`copy-code-button premium-button h-11 rounded-xl border border-white/15 bg-white px-4 text-xs font-black uppercase tracking-[0.08em] text-black transition ${
                copyText === "Copied!" ? "copied" : ""
              }`}
            >
              {copyText}
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#d4af37]">
          Waiting Room
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">Gather Players</h1>
        <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-zinc-400">
          Share the room code. The host starts when everyone is ready.
        </p>

        <div className="mt-8">
          <h2 className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">
            Players {room.players.length}/8
          </h2>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {room.players.map((player) => (
              <li
                key={player.id}
                className={`rounded-2xl border px-4 py-4 font-black shadow-[0_16px_50px_rgba(0,0,0,0.25)] ${
                  player.id === room.hostId
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-white/5 text-white"
                }`}
              >
                <span className="block truncate">{player.name}</span>
                <span className="mt-1 block text-xs uppercase tracking-[0.2em] opacity-50">
                  {player.id === room.hostId ? "Host" : "Player"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {error ? (
          <p className="mt-5 rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-3 text-sm font-bold text-red-100">
            {error}
          </p>
        ) : null}

        {isHost ? (
          <button
            type="button"
            onClick={onStartGame}
            className="premium-button premium-primary mt-8 h-14 w-full rounded-2xl bg-white px-8 text-base font-black uppercase tracking-[0.08em] text-black shadow-[0_22px_70px_rgba(255,255,255,0.14)] transition duration-200"
          >
            Start Game
          </button>
        ) : (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold text-zinc-400">
            Waiting for the host to start the game.
          </p>
        )}
      </div>
    </div>
  );
}
