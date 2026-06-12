"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { LobbyMaskPlayer, Room } from "@/types/room";

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

const keyMap: Record<string, { dx: number; dy: number }> = {
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
  s: { dx: 0, dy: 1 },
  w: { dx: 0, dy: -1 },
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
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const isHost = room.hostId === currentPlayerId;
  const isCameraOn = Boolean(cameraStream);
  const isMicOn = Boolean(micStream);
  const sortedScores = [...room.lobbyGame.players].sort((a, b) => b.score - a.score);

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

    function handleAudioChunk({ chunk }: { chunk: string; playerId: string }) {
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (keyMap[key]) {
        event.preventDefault();
        pressedKeysRef.current.add(key);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      pressedKeysRef.current.delete(key);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const intervalId = window.setInterval(() => {
      let dx = 0;
      let dy = 0;

      for (const key of pressedKeysRef.current) {
        dx += keyMap[key]?.dx ?? 0;
        dy += keyMap[key]?.dy ?? 0;
      }

      if (dx !== 0 || dy !== 0) {
        socket.emit("lobby:move", { dx, dy });
      }
    }, 70);

    return () => window.clearInterval(intervalId);
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

  function handleRestartMiniGame() {
    socket?.emit("lobby:restart");
  }

  return (
    <div className="lobby-shell">
      <aside className="lobby-panel lobby-left">
        <div>
          <p className="lobby-eyebrow">Waiting Room</p>
          <h1>RAVO</h1>
          <span>made by Dorodini</span>
        </div>

        <div className="lobby-code-card">
          <p>Room Code</p>
          <strong>{room.code}</strong>
          <button type="button" onClick={handleCopyCode} className={copyText === "Copied!" ? "copied" : ""}>
            {copyText}
          </button>
        </div>

        <div className="lobby-player-list">
          <p>Players {room.players.length}/8</p>
          {room.players.map((player) => (
            <div key={player.id} className={player.id === room.hostId ? "host" : ""}>
              <strong>{player.name}</strong>
              <span>{player.id === room.hostId ? "Host" : "Player"}</span>
              <i className={player.micOn ? "on" : "off"} />
            </div>
          ))}
        </div>

        {error ? <p className="lobby-error">{error}</p> : null}
      </aside>

      <section className="lobby-arena-card">
        <div className="lobby-arena-header">
          <div>
            <p>Lobby Mini Game</p>
            <h2>Mask Hill</h2>
          </div>
          {room.lobbyGame.winnerName ? (
            <strong>Lobby Champion: {room.lobbyGame.winnerName}</strong>
          ) : (
            <span>WASD / Arrow Keys</span>
          )}
        </div>

        <div className="mask-hill-arena">
          <div
            className="mask-hill-zone"
            style={{
              height: `${room.lobbyGame.hill.radius * 2}%`,
              left: `${room.lobbyGame.hill.x}%`,
              top: `${room.lobbyGame.hill.y}%`,
              width: `${room.lobbyGame.hill.radius * 2}%`,
            }}
          />

          {room.lobbyGame.players.map((player) => (
            <MaskPlayer
              key={player.id}
              isMe={player.id === currentPlayerId}
              player={player}
            />
          ))}
        </div>

        <div className="lobby-start-row">
          {isHost ? (
            <button type="button" onClick={onStartGame} className="lobby-start-button">
              Start RAVO Game
            </button>
          ) : (
            <p>Waiting for the host to start the game.</p>
          )}
          <button type="button" onClick={handleRestartMiniGame} className="lobby-secondary-button">
            Restart Mask Hill
          </button>
        </div>
      </section>

      <aside className="lobby-panel lobby-right">
        <div className={`lobby-camera-card ${isCameraOn ? "camera-on" : "camera-off"} ${isMicOn ? "mic-on" : "mic-off"}`}>
          <p>You</p>
          {isCameraOn && cameraStream ? (
            <video ref={localVideoRef} autoPlay muted playsInline />
          ) : (
            <div className="lobby-camera-placeholder">MASK</div>
          )}
        </div>

        <div className="lobby-media-buttons">
          <button type="button" onClick={handleToggleCamera} className={isCameraOn ? "on" : "off"}>
            Camera: {isCameraOn ? "On" : "Off"}
          </button>
          <button type="button" onClick={handleToggleMic} className={isMicOn ? "on" : "off"}>
            Mic: {isMicOn ? "On" : "Off"}
          </button>
        </div>

        {mediaError ? <p className="lobby-error">{mediaError}</p> : null}

        <div className="lobby-webcams">
          {room.players
            .filter((player) => player.id !== currentPlayerId)
            .map((player) => (
              <div key={player.id} className={`lobby-remote-camera ${player.cameraOn ? "camera-on" : "camera-off"}`}>
                <span>{player.name}</span>
                {remoteVideoFrames[player.id] && player.cameraOn ? (
                  <img src={remoteVideoFrames[player.id]} alt={`${player.name} camera`} />
                ) : (
                  <div>CAMERA OFF</div>
                )}
                <i className={player.micOn ? "on" : "off"} />
              </div>
            ))}
        </div>

        <div className="lobby-scoreboard">
          <p>Scoreboard</p>
          {sortedScores.map((player) => (
            <div key={player.id}>
              <span>{player.name}</span>
              <strong>{player.score}</strong>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function MaskPlayer({ isMe, player }: { isMe: boolean; player: LobbyMaskPlayer }) {
  return (
    <div
      className={`mask-player ${isMe ? "me" : ""}`}
      style={{
        left: `${player.x}%`,
        top: `${player.y}%`,
      }}
      title={player.name}
    >
      <span>M</span>
      <strong>{player.name.slice(0, 8)}</strong>
    </div>
  );
}
