"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { ChatMessage, Player, Room } from "@/types/room";

type RoomPanelProps = {
  cameraStream: MediaStream | null;
  chatMessages: ChatMessage[];
  currentPlayerId: string;
  error?: string;
  micStream: MediaStream | null;
  onCameraStreamChange: (stream: MediaStream | null) => void;
  onMicStreamChange: (stream: MediaStream | null) => void;
  onSendChat: (message: string) => void;
  onStartGame: () => void;
  room: Room;
  socket: Socket | null;
};

function formatChatTime(sentAt: number) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(sentAt);
}

export function RoomPanel({
  cameraStream,
  chatMessages,
  currentPlayerId,
  error,
  micStream,
  onCameraStreamChange,
  onMicStreamChange,
  onSendChat,
  onStartGame,
  room,
  socket,
}: RoomPanelProps) {
  const [copyText, setCopyText] = useState("Copy Code");
  const [chatDraft, setChatDraft] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [remoteVideoFrames, setRemoteVideoFrames] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const isHost = room.hostId === currentPlayerId;
  const isCameraOn = Boolean(cameraStream);
  const isMicOn = Boolean(micStream);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatMessages]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.emit("media:status", {
      cameraOn: isCameraOn,
      micOn: isMicOn,
    });
  }, [isCameraOn, isMicOn, socket]);

  useEffect(() => {
    if (!socket || !cameraStream || !isCameraOn) {
      return;
    }

    const activeSocket = socket;
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let intervalId = 0;
    let stopped = false;

    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = cameraStream;

    async function start() {
      try {
        await video.play();
      } catch {
        return;
      }

      canvas.width = 320;
      canvas.height = 180;
      intervalId = window.setInterval(() => {
        if (stopped || !context || video.readyState < 2) {
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        activeSocket.emit("media:video-frame", {
          frame: canvas.toDataURL("image/jpeg", 0.48),
        });
      }, 220);
    }

    void start();

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      video.srcObject = null;
    };
  }, [cameraStream, isCameraOn, socket]);

  useEffect(() => {
    if (!socket || !micStream || !isMicOn || typeof MediaRecorder === "undefined") {
      return;
    }

    const activeSocket = socket;
    let recorder: MediaRecorder | null = null;

    try {
      recorder = new MediaRecorder(micStream, { mimeType: "audio/webm" });
    } catch {
      try {
        recorder = new MediaRecorder(micStream);
      } catch {
        return;
      }
    }

    recorder.ondataavailable = (event) => {
      if (!event.data.size) {
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          activeSocket.emit("media:audio-chunk", {
            chunk: reader.result,
          });
        }
      };
      reader.readAsDataURL(event.data);
    };

    recorder.start(800);

    return () => {
      if (recorder?.state !== "inactive") {
        recorder?.stop();
      }
    };
  }, [isMicOn, micStream, socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    function handleVideoFrame({ frame, playerId }: { frame: string; playerId: string }) {
      setRemoteVideoFrames((current) => ({
        ...current,
        [playerId]: frame,
      }));
    }

    function handleAudioChunk({ chunk }: { chunk: string }) {
      const audio = new Audio(chunk);
      audio.volume = 0.9;
      void audio.play().catch(() => undefined);
    }

    socket.on("media:video-frame", handleVideoFrame);
    socket.on("media:audio-chunk", handleAudioChunk);

    return () => {
      socket.off("media:video-frame", handleVideoFrame);
      socket.off("media:audio-chunk", handleAudioChunk);
    };
  }, [socket]);

  async function handleCopyCode() {
    await navigator.clipboard.writeText(room.code);
    setCopyText("Copied!");

    window.setTimeout(() => {
      setCopyText("Copy Code");
    }, 2000);
  }

  async function handleToggleCamera() {
    setMediaError("");

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      onCameraStreamChange(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      });

      onCameraStreamChange(stream);
    } catch {
      setMediaError("Camera permission was blocked.");
    }
  }

  async function handleToggleMic() {
    setMediaError("");

    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      onMicStreamChange(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      onMicStreamChange(stream);
    } catch {
      setMediaError("Microphone permission was blocked.");
    }
  }

  function handleSendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = chatDraft.trim();

    if (!trimmedMessage) {
      return;
    }

    onSendChat(trimmedMessage);
    setChatDraft("");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-black px-4 py-5 text-white sm:px-6">
      <div className="mx-auto grid min-h-[720px] max-w-[1500px] grid-cols-1 gap-5 rounded-[2rem] border border-white/10 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),rgba(0,0,0,0.92)_54%,#000)] p-4 shadow-[0_35px_140px_rgba(0,0,0,0.85)] lg:grid-cols-[280px_1fr_360px]">
        <aside className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-[#d4af37]/10 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4af37]">
              Waiting Room
            </p>
            <h1 className="mt-3 text-6xl font-black leading-none tracking-[-0.08em]">
              RAVO
            </h1>
            <p className="mt-1 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black tracking-[0.16em] text-zinc-400">
              made by Dorodini
            </p>
          </div>

          <div className="relative mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
              Room Code
            </p>
            <strong className="mt-2 block text-4xl font-black tracking-[0.08em]">
              {room.code}
            </strong>
            <button
              type="button"
              onClick={handleCopyCode}
              className={`premium-button mt-4 h-11 w-full rounded-xl border border-white/15 bg-white text-xs font-black uppercase tracking-[0.08em] text-black transition ${
                copyText === "Copied!" ? "copied" : ""
              }`}
            >
              {copyText}
            </button>
          </div>

          <div className="relative mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                Players
              </p>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-zinc-300">
                {room.players.length}/8
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              {room.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-3 py-3"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${player.cameraOn ? "bg-green-400 shadow-[0_0_16px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.65)]"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{player.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      {player.id === room.hostId ? "Host" : "Player"}
                    </p>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${player.micOn ? "bg-green-400" : "bg-red-500"}`} />
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <p className="relative mt-5 rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-3 text-sm font-bold text-red-100">
              {error}
            </p>
          ) : null}

          {isHost ? (
            <button
              type="button"
              onClick={onStartGame}
              className="premium-button premium-primary relative mt-6 h-14 w-full rounded-2xl bg-white px-8 text-base font-black uppercase tracking-[0.08em] text-black shadow-[0_22px_70px_rgba(255,255,255,0.14)] transition duration-200"
            >
              Start Game
            </button>
          ) : (
            <p className="relative mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold text-zinc-400">
              Waiting for the host to start the game.
            </p>
          )}
        </aside>

        <section className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-zinc-950/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(212,175,55,0.12),transparent_22%),radial-gradient(ellipse_at_center,transparent_0_42%,rgba(255,255,255,0.035)_43%,transparent_44%)]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 text-[180px] font-black tracking-[-0.12em] text-white/[0.025] -translate-x-1/2 -translate-y-1/2">
            RAVO
          </div>

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4af37]">
                Player Table
              </p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.04em]">
                Ready Room
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">
              Waiting
            </span>
          </div>

          <div className="relative mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {room.players.map((player) => (
              <PlayerWaitingCard
                key={player.id}
                currentPlayerId={currentPlayerId}
                frame={remoteVideoFrames[player.id]}
                isCameraOn={player.id === currentPlayerId ? isCameraOn : Boolean(player.cameraOn)}
                isMicOn={player.id === currentPlayerId ? isMicOn : Boolean(player.micOn)}
                isLocalPlayer={player.id === currentPlayerId}
                localStream={player.id === currentPlayerId ? cameraStream : null}
                player={player}
                room={room}
              />
            ))}
          </div>
        </section>

        <aside className="grid min-h-0 gap-5">
          <section className="rounded-[1.5rem] border border-white/10 bg-black/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">
                Lobby Camera
              </h2>
              <span className={`h-2.5 w-2.5 rounded-full ${isMicOn ? "bg-green-400" : "bg-red-500"}`} />
            </div>

            <div className={`mt-4 overflow-hidden rounded-2xl border-2 bg-black ${isCameraOn ? "border-green-500 shadow-[0_0_28px_rgba(34,197,94,0.18)]" : "border-red-600 shadow-[0_0_24px_rgba(239,68,68,0.12)]"}`}>
              <div className="relative aspect-video">
                {isCameraOn && cameraStream ? (
                  <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                ) : (
                  <CameraPlaceholder label="Camera Off" />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white">
                  You
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleToggleCamera}
                className={`h-11 rounded-xl border text-xs font-black uppercase tracking-[0.08em] transition hover:-translate-y-0.5 ${
                  isCameraOn
                    ? "border-green-500/70 bg-green-950/40 text-green-200"
                    : "border-red-500/70 bg-red-950/30 text-red-200"
                }`}
              >
                Camera: {isCameraOn ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={handleToggleMic}
                className={`h-11 rounded-xl border text-xs font-black uppercase tracking-[0.08em] transition hover:-translate-y-0.5 ${
                  isMicOn
                    ? "border-green-500/70 bg-green-950/40 text-green-200"
                    : "border-red-500/70 bg-red-950/30 text-red-200"
                }`}
              >
                Mic: {isMicOn ? "On" : "Off"}
              </button>
            </div>

            {mediaError ? (
              <p className="mt-3 rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-3 text-xs font-bold text-red-100">
                {mediaError}
              </p>
            ) : null}
          </section>

          <section className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] rounded-[1.5rem] border border-white/10 bg-black/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">
                Lobby Chat
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                Room
              </span>
            </div>

            <div className="mt-4 max-h-[300px] min-h-[230px] overflow-y-auto rounded-2xl border border-white/10 bg-black/45 p-3">
              {chatMessages.length === 0 ? (
                <div className="grid h-full min-h-[190px] place-items-center text-center text-sm font-bold text-zinc-600">
                  No messages yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((message) => (
                    <div key={message.id} className="rounded-xl bg-white/[0.055] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="truncate text-sm font-black text-white">
                          {message.playerName}
                        </strong>
                        <span className="text-[10px] font-black text-zinc-600">
                          {formatChatTime(message.sentAt)}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold leading-5 text-zinc-300">
                        {message.message}
                      </p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <form className="mt-3 flex gap-2" onSubmit={handleSendChat}>
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder="Type a message..."
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/70 px-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-[#d4af37]/60"
              />
              <button
                type="submit"
                className="rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/12 px-5 text-xs font-black uppercase tracking-[0.08em] text-[#f7d86d] transition hover:-translate-y-0.5 hover:border-[#d4af37]/70"
              >
                Send
              </button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}

function PlayerWaitingCard({
  currentPlayerId,
  frame,
  isCameraOn,
  isLocalPlayer,
  isMicOn,
  localStream,
  player,
  room,
}: {
  currentPlayerId: string;
  frame?: string;
  isCameraOn: boolean;
  isLocalPlayer: boolean;
  isMicOn: boolean;
  localStream: MediaStream | null;
  player: Player;
  room: Room;
}) {
  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/72 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
      <div className={`relative aspect-video border-b-2 bg-black ${isCameraOn ? "border-green-500" : "border-red-600"}`}>
        {isLocalPlayer && isCameraOn ? (
          <video
            ref={(node) => {
              if (node && node.srcObject !== localStream) {
                node.srcObject = localStream;
              }
            }}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : frame && isCameraOn ? (
          <img src={frame} alt={`${player.name} camera`} className="h-full w-full object-cover" />
        ) : (
          <CameraPlaceholder label="Camera Off" />
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-full bg-black/75 px-3 py-1 text-sm font-black text-white">
            {player.name}
          </span>
          {player.id === room.hostId ? (
            <span className="rounded-full border border-[#d4af37]/40 bg-[#d4af37]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#f7d86d]">
              Host
            </span>
          ) : null}
          {player.id === currentPlayerId ? (
            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-200">
              You
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
            Status
          </p>
          <p className="mt-1 text-sm font-black text-zinc-200">Waiting</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${isCameraOn ? "bg-green-400 shadow-[0_0_18px_rgba(34,197,94,0.7)]" : "bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.6)]"}`} />
          <span className={`h-3 w-3 rounded-full ${isMicOn ? "bg-green-400 shadow-[0_0_18px_rgba(34,197,94,0.7)]" : "bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.6)]"}`} />
        </div>
      </div>
    </article>
  );
}

function CameraPlaceholder({ label }: { label: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_58%)]">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-2xl font-black text-white/70">
          M
        </div>
        <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-zinc-500">
          {label}
        </p>
      </div>
    </div>
  );
}
