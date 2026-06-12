"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

type ConnectionState = "connecting" | "connected" | "disconnected";

export function SocketStatus() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [socketId, setSocketId] = useState("");

  useEffect(() => {
    const socket = io();

    socket.on("connect", () => {
      setConnectionState("connected");
      setSocketId(socket.id ?? "");
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
      setSocketId("");
    });

    socket.on("connect_error", () => {
      setConnectionState("disconnected");
      setSocketId("");
    });

    socket.on("server:welcome", (payload: { socketId: string }) => {
      setSocketId(payload.socketId);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const isConnected = connectionState === "connected";

  return (
    <div className="mt-8 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left shadow-2xl backdrop-blur">
      <div className="flex items-center gap-3">
        <span
          className={`h-3 w-3 rounded-full ${
            isConnected ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" : "bg-red-500"
          }`}
        />
        <p className="text-sm font-black text-white">
          Server{" "}
          <span className={isConnected ? "text-emerald-300" : "text-red-300"}>
            {connectionState}
          </span>
        </p>
      </div>

      {socketId ? (
        <p className="mt-2 truncate text-xs font-semibold text-zinc-500">
          Socket ID: {socketId}
        </p>
      ) : null}
    </div>
  );
}
