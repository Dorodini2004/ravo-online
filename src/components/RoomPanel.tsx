"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { CardImage } from "@/components/CardImage";
import type { Room } from "@/types/room";

type RoomPanelProps = {
  cameraStream: MediaStream | null;
  currentPlayerId: string;
  error?: string;
  micStream: MediaStream | null;
  onCameraStreamChange: (stream: MediaStream | null) => void;
  onMicStreamChange: (stream: MediaStream | null) => void;
  onStartGame: () => void;
  room: Room;
  socket: Socket | null;
};

export function RoomPanel({
  cameraStream,
  currentPlayerId,
  error,
  micStream,
  onCameraStreamChange,
  onMicStreamChange,
  onStartGame,
  room,
  socket,
}: RoomPanelProps) {
  const [copyText, setCopyText] = useState("Copy Code");
  const [mediaError, setMediaError] = useState("");
  const [remoteVideoFrames, setRemoteVideoFrames] = useState<Record<string, string>>({});
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

  return (
    <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/90 p-5 shadow-[0_32px_110px_rgba(0,0,0,0.65)] backdrop-blur sm:p-8 xl:grid-cols-[0.9fr_1.1fr_0.95fr]">
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
          Share the room code. Players can turn on camera and mic before the host starts.
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
                <span className="mt-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-60">
                  {player.id === room.hostId ? "Host" : "Player"}
                  <i className={`h-2 w-2 rounded-full ${player.micOn ? "bg-green-400" : "bg-red-500"}`} />
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

      <aside className="rounded-[1.5rem] border border-white/10 bg-black/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <h2 className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">
          Lobby Camera
        </h2>

        <div className={`mt-4 overflow-hidden rounded-2xl border-2 bg-black ${isCameraOn ? "border-green-500 shadow-[0_0_28px_rgba(34,197,94,0.18)]" : "border-red-600 shadow-[0_0_24px_rgba(239,68,68,0.12)]"}`}>
          <div className="relative aspect-video">
            {isCameraOn && cameraStream ? (
              <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-sm font-black uppercase tracking-[0.24em] text-zinc-500">
                Camera Off
              </div>
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
            className={`h-11 rounded-xl border text-xs font-black uppercase tracking-[0.08em] ${
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
            className={`h-11 rounded-xl border text-xs font-black uppercase tracking-[0.08em] ${
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

        <div className="mt-5 grid max-h-80 gap-3 overflow-auto pr-1">
          {room.players
            .filter((player) => player.id !== currentPlayerId)
            .map((player) => (
              <div
                key={player.id}
                className={`overflow-hidden rounded-2xl border-2 bg-black ${
                  player.cameraOn ? "border-green-500/80" : "border-red-600/80"
                }`}
              >
                <div className="relative aspect-video">
                  {remoteVideoFrames[player.id] && player.cameraOn ? (
                    <img
                      src={remoteVideoFrames[player.id]}
                      alt={`${player.name} camera`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                      Camera Off
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white">
                    {player.name}
                  </span>
                  <i className={`absolute bottom-3 right-3 h-2.5 w-2.5 rounded-full ${player.micOn ? "bg-green-400" : "bg-red-500"}`} />
                </div>
              </div>
            ))}
        </div>
      </aside>
    </div>
  );
}
