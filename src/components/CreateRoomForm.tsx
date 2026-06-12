"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { GamePanel } from "@/components/GamePanel";
import { RoomPanel } from "@/components/RoomPanel";
import type {
  Card,
  ChatMessage,
  GameStartedPayload,
  GameStatePayload,
  Room,
  RoomResponse,
} from "@/types/room";

export function CreateRoomForm() {
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState("");
  const [currentPlayerId, setCurrentPlayerId] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const nextSocket = io();

    nextSocket.on("connect", () => {
      setCurrentPlayerId(nextSocket.id ?? "");
    });

    nextSocket.on("room:updated", (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    nextSocket.on("game:started", (payload: GameStartedPayload) => {
      setRoom(payload.room);
      setHand(payload.hand);
      setError("");
    });

    nextSocket.on("game:state", (payload: GameStatePayload) => {
      setRoom(payload.room);
      setHand(payload.hand);
      setError("");
    });

    nextSocket.on("game:returned-to-lobby", (payload: { room: Room }) => {
      setRoom(payload.room);
      setHand([]);
      setError("");
    });

    nextSocket.on("chat:message", (message: ChatMessage) => {
      setChatMessages((current) => [...current.slice(-40), message]);
    });

    socketRef.current = nextSocket;

    return () => {
      nextSocket.disconnect();
      socketRef.current = null;
      setCurrentPlayerId("");
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!socketRef.current) {
      setError("Still connecting to the server. Try again in a moment.");
      return;
    }

    socketRef.current.emit(
      "room:create",
      { playerName },
      (response: RoomResponse) => {
        if (!response.ok) {
          setError(response.error);
          return;
        }

        setRoom(response.room);
      },
    );
  }

  function handleStartGame() {
    setError("");

    if (!socketRef.current) {
      setError("Still connecting to the server. Try again in a moment.");
      return;
    }

    socketRef.current.emit("game:start", (response: RoomResponse) => {
      if (!response.ok) {
        setError(response.error);
      }
    });
  }

  function handlePlayCard(cardId: string) {
    setError("");

    if (!socketRef.current) {
      setError("Still connecting to the server. Try again in a moment.");
      return;
    }

    socketRef.current.emit(
      "game:play-card",
      { cardId },
      (response: RoomResponse) => {
        if (!response.ok) {
          setError(response.error);
        }
      },
    );
  }

  function handleDrawCard() {
    setError("");

    if (!socketRef.current) {
      setError("Still connecting to the server. Try again in a moment.");
      return;
    }

    socketRef.current.emit("game:draw-card", (response: RoomResponse) => {
      if (!response.ok) {
        setError(response.error);
      }
    });
  }

  function handleCallRavo() {
    setError("");

    if (!socketRef.current) {
      setError("Still connecting to the server. Try again in a moment.");
      return;
    }

    socketRef.current.emit("game:call-ravo", (response: RoomResponse) => {
      if (!response.ok) {
        setError(response.error);
      }
    });
  }

  function handleSendChat(message: string) {
    if (!socketRef.current) {
      setError("Still connecting to the server. Try again in a moment.");
      return;
    }

    socketRef.current.emit("chat:send", { message }, (response: { ok: boolean; error?: string }) => {
      if (!response.ok && response.error) {
        setError(response.error);
      }
    });
  }

  if (room && room.status !== "waiting") {
    return (
      <GamePanel
        chatMessages={chatMessages}
        currentPlayerId={currentPlayerId}
        error={error}
        hand={hand}
        onCallRavo={handleCallRavo}
        onDrawCard={handleDrawCard}
        onPlayCard={handlePlayCard}
        onPlayAgain={() => {
          socketRef.current?.emit("game:play-again", (response: RoomResponse) => {
            if (!response.ok) {
              setError(response.error);
              return;
            }

            setRoom(response.room);
            setHand([]);
            setError("");
          });
        }}
        onSendChat={handleSendChat}
        room={room}
        socket={socketRef.current}
      />
    );
  }

  if (room) {
    return (
      <RoomPanel
        currentPlayerId={currentPlayerId}
        error={error}
        onStartGame={handleStartGame}
        room={room}
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/90 p-6 shadow-[0_32px_110px_rgba(0,0,0,0.65)] backdrop-blur sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#d4af37]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 right-8 text-8xl font-black text-white/[0.025]">
        RAVO
      </div>

      <div className="relative">
        <p className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#d4af37]">
          Host a Match
        </p>

        <h1 className="mt-4 text-5xl font-black text-white">Create Game</h1>

        <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-zinc-400">
          Enter your name to create a private room code for your friends.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-zinc-300">
              Your name
            </span>
            <input
              type="text"
              name="playerName"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Example: Patrik"
              className="mt-3 h-15 w-full rounded-2xl border border-white/10 bg-black/55 px-5 text-base font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-white/60 focus:bg-black/75"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-3 text-sm font-bold text-red-100">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="premium-button premium-primary premium-particles h-15 w-full rounded-2xl bg-white px-8 text-base font-black uppercase tracking-[0.08em] text-black shadow-[0_22px_70px_rgba(255,255,255,0.14)] transition duration-200"
          >
            Create Room
          </button>
        </form>
      </div>
    </div>
  );
}
