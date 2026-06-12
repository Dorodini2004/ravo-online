"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Socket } from "socket.io-client";
import { CardImage } from "@/components/CardImage";
import { LocalCamera } from "@/components/LocalCamera";
import type { Card, ChatMessage, Player, Room } from "@/types/room";

const DESIGN_WIDTH = 1600;
const DESIGN_HEIGHT = 900;
const DISPLAY_SETTINGS_KEY = "ravo-display-settings-v2";
const SCALE_OPTIONS = [0.7, 0.8, 0.9, 1, 1.1];

type GamePanelProps = {
  chatMessages: ChatMessage[];
  currentPlayerId: string;
  error?: string;
  hand: Card[];
  onCallRavo: () => void;
  onDrawCard: () => void;
  onPlayCard: (cardId: string) => void;
  onPlayAgain: () => void;
  onSendChat: (message: string) => void;
  room: Room;
  socket: Socket | null;
};

type OpponentSeat = {
  className: string;
  key: string;
  player: Player;
};

type DisplaySettings = {
  userScale: number;
};

function getDefaultUserScale() {
  if (typeof window === "undefined") {
    return 1;
  }

  return window.matchMedia("(min-aspect-ratio: 21/9)").matches ? 0.9 : 1;
}

function loadDisplaySettings(): DisplaySettings {
  if (typeof window === "undefined") {
    return { userScale: 1 };
  }

  try {
    const saved = window.localStorage.getItem(DISPLAY_SETTINGS_KEY);

    if (!saved) {
      return { userScale: getDefaultUserScale() };
    }

    const parsed = JSON.parse(saved) as Partial<DisplaySettings>;

    return {
      userScale: SCALE_OPTIONS.includes(parsed.userScale ?? 0)
        ? parsed.userScale ?? getDefaultUserScale()
        : getDefaultUserScale(),
    };
  } catch {
    return { userScale: getDefaultUserScale() };
  }
}

function getCardLabel(card: Card) {
  if (card.type === "number") {
    return card.value.toString();
  }

  if (card.type === "ravo-joker") {
    return "RAVO";
  }

  return "BLUFF";
}

function getNextNumber(currentNumber: number) {
  return currentNumber === 10 ? 1 : currentNumber + 1;
}

function getNextScale(currentScale: number, direction: -1 | 1) {
  const currentIndex = SCALE_OPTIONS.indexOf(currentScale);

  if (currentIndex === -1) {
    return direction === 1 ? 1 : 0.9;
  }

  return SCALE_OPTIONS[Math.max(0, Math.min(SCALE_OPTIONS.length - 1, currentIndex + direction))];
}

function getHandCardStyle(index: number, total: number, isSelected: boolean) {
  const center = (total - 1) / 2;
  const offset = index - center;
  const maxSpread = total > 10 ? 720 : 680;
  const spacing = total <= 1 ? 0 : Math.min(70, maxSpread / (total - 1));
  const rotate = Math.max(-25, Math.min(25, offset * 5.2));
  const x = offset * spacing;
  const curve = Math.abs(offset) * 5;
  const y = isSelected ? -42 : curve;
  const scale = isSelected ? 1.1 : total > 12 ? 0.88 : 1;

  return {
    left: "50%",
    transform: `translateX(calc(-50% + ${x}px)) translateY(calc(${y}px + var(--hover-lift, 0px))) rotate(${rotate}deg) scale(calc(${scale} * var(--hover-scale, 1)))`,
    zIndex: isSelected ? 100 : index + 1,
  };
}

function getOpponentSeats(opponents: Player[]): OpponentSeat[] {
  const positions = [
    { key: "top-left", className: "seat-top-left" },
    { key: "top-center", className: "seat-top-center" },
    { key: "top-right", className: "seat-top-right" },
    { key: "left-center", className: "seat-left-center" },
    { key: "right-center", className: "seat-right-center" },
  ];

  return opponents.slice(0, positions.length).map((player, index) => {
    const position = positions[index];

    return {
      className: position.className,
      key: position.key,
      player,
    };
  });
}

export function GamePanel({
  chatMessages,
  currentPlayerId,
  error,
  hand,
  onCallRavo,
  onDrawCard,
  onPlayCard,
  onPlayAgain,
  onSendChat,
  room,
  socket,
}: GamePanelProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [roomCodeCopyText, setRoomCodeCopyText] = useState("Copy Code");
  const [localChatMessages, setLocalChatMessages] = useState<ChatMessage[]>([]);
  const [isSoundOn, setIsSoundOn] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem("ravo-sound-on") !== "false";
  });
  const [isPlayLoading, setIsPlayLoading] = useState(false);
  const [isDrawLoading, setIsDrawLoading] = useState(false);
  const [isRavoLoading, setIsRavoLoading] = useState(false);
  const [drawAnimationKey, setDrawAnimationKey] = useState(0);
  const [playAnimationCard, setPlayAnimationCard] = useState<Card | null>(null);
  const [revealedCardVisible, setRevealedCardVisible] = useState(false);
  const [countdownTick, setCountdownTick] = useState(() => Date.now());
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [cameraError, setCameraError] = useState("");
  const [settings, setSettings] = useState<DisplaySettings>(() => loadDisplaySettings());
  const [stageScale, setStageScale] = useState(1);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerIdsRef = useRef<Set<string>>(new Set());
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  const me = room.players.find((player) => player.id === currentPlayerId);
  const winner = room.players.find((player) => player.id === room.winnerId);
  const opponents = room.players.filter((player) => player.id !== currentPlayerId);
  const seats = getOpponentSeats(opponents);
  const isYourTurn = room.currentTurnPlayerId === currentPlayerId;
  const didYouCallRavo = room.pendingRavoCallers.includes(currentPlayerId);
  const canCallRavo =
    room.status === "challenge" &&
    room.lastPlayedBy !== currentPlayerId &&
    !didYouCallRavo;
  const canPlayCard =
    (room.status === "playing" && isYourTurn) ||
    (room.status === "bluff-extra" && room.bluffExtraPlayerId === currentPlayerId && isYourTurn);
  const canDrawCard = room.status === "playing" && isYourTurn;
  const selectedCard = hand.find((card) => card.id === selectedCardId);
  const lastPlayedBy = room.players.find((player) => player.id === room.lastPlayedBy);
  const visibleChatMessages = [...chatMessages, ...localChatMessages].slice(-12);
  const isCameraOn = Boolean(cameraStream);
  const isMicOn = Boolean(micStream);
  const countdownSeconds =
    room.status === "challenge" && room.challengeEndsAt
      ? Math.max(0, Math.ceil((room.challengeEndsAt - countdownTick) / 1000))
      : 0;
  const revealStatus = room.lastRevealWasChallenged
    ? `Challenged by ${(room.lastRevealCallers ?? []).join(", ") || "a player"}`
    : "Not challenged";
  const lastPlayedRevealedLabel = room.lastRevealedCardLabel ?? (
    room.lastRevealedCard ? getCardLabel(room.lastRevealedCard) : null
  );
  const lastRevealedCardId = room.lastRevealedCard?.id ?? null;

  useEffect(() => {
    function updateStageScale() {
      const nextScale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);

      setStageScale(nextScale);
    }

    updateStageScale();
    window.addEventListener("resize", updateStageScale);

    return () => {
      window.removeEventListener("resize", updateStageScale);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem("ravo-sound-on", isSoundOn.toString());
  }, [isSoundOn]);

  useEffect(() => {
    if (room.status !== "challenge" || !room.challengeEndsAt) {
      return;
    }

    const interval = window.setInterval(() => setCountdownTick(Date.now()), 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [room.challengeEndsAt, room.status]);

  useEffect(() => {
    if (!lastRevealedCardId || !room.lastRevealedAt) {
      return;
    }

    const showTimeout = window.setTimeout(() => {
      setRevealedCardVisible(true);
    }, 0);

    const hideTimeout = window.setTimeout(() => {
      setRevealedCardVisible(false);
    }, 2000);

    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [lastRevealedCardId, room.lastRevealedAt]);

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
    const nextStream = new MediaStream();

    cameraStream?.getVideoTracks().forEach((track) => nextStream.addTrack(track));
    micStream?.getAudioTracks().forEach((track) => {
      track.enabled = isMicOn;
      nextStream.addTrack(track);
    });
    localMediaStreamRef.current = nextStream;

    async function updatePeerConnections() {
      const renegotiations: Promise<void>[] = [];

      for (const [peerId, connection] of peerConnectionsRef.current.entries()) {
      const senders = connection.getSenders();

      for (const sender of senders) {
        connection.removeTrack(sender);
      }

      nextStream.getTracks().forEach((track) => {
        connection.addTrack(track, nextStream);
      });

        if (socket && connection.signalingState === "stable") {
          renegotiations.push(
            connection
              .createOffer()
              .then((offer) => connection.setLocalDescription(offer).then(() => offer))
              .then((offer) => {
                socket.emit("webrtc:offer", {
                  offer,
                  to: peerId,
                });
              })
              .catch(() => {
                peerConnectionsRef.current.delete(peerId);
              }),
          );
        }
      }

      if (socket && peerConnectionsRef.current.size === 0 && (isCameraOn || isMicOn)) {
        socket.emit("webrtc:ready");
      }

      await Promise.all(renegotiations);
    }

    void updatePeerConnections();
  }, [cameraStream, isCameraOn, isMicOn, micStream, socket]);

  useEffect(() => {
    if (!socket || !currentPlayerId || room.status === "waiting") {
      return;
    }

    const createPeerConnection = (peerId: string) => {
      const existing = peerConnectionsRef.current.get(peerId);

      if (existing) {
        return existing;
      }

      const connection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      localMediaStreamRef.current?.getTracks().forEach((track) => {
        connection.addTrack(track, localMediaStreamRef.current as MediaStream);
      });

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:ice-candidate", {
            candidate: event.candidate,
            to: peerId,
          });
        }
      };

      connection.ontrack = (event) => {
        const [stream] = event.streams;

        if (stream) {
          setRemoteStreams((current) => ({
            ...current,
            [peerId]: stream,
          }));
        }
      };

      connection.onconnectionstatechange = () => {
        if (["closed", "failed", "disconnected"].includes(connection.connectionState)) {
          peerConnectionsRef.current.delete(peerId);
          setRemoteStreams((current) => {
            const next = { ...current };
            delete next[peerId];
            return next;
          });
        }
      };

      peerConnectionsRef.current.set(peerId, connection);
      return connection;
    };

    async function createOffer(peerId: string) {
      peerIdsRef.current.add(peerId);
      const connection = createPeerConnection(peerId);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      socket?.emit("webrtc:offer", { offer, to: peerId });
    }

    async function handleExistingPeers({ peerIds }: { peerIds: string[] }) {
      for (const peerId of peerIds) {
        if (peerId !== currentPlayerId) {
          peerIdsRef.current.add(peerId);
          await createOffer(peerId);
        }
      }
    }

    async function handlePeerReady({ peerId }: { peerId: string }) {
      if (peerId !== currentPlayerId) {
        peerIdsRef.current.add(peerId);
        await createOffer(peerId);
      }
    }

    async function handleOffer({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) {
      peerIdsRef.current.add(from);
      const connection = createPeerConnection(from);
      await connection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      socket?.emit("webrtc:answer", { answer, to: from });
    }

    async function handleAnswer({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) {
      const connection = peerConnectionsRef.current.get(from);

      if (connection && !connection.currentRemoteDescription) {
        await connection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    }

    async function handleIceCandidate({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) {
      const connection = peerConnectionsRef.current.get(from) ?? createPeerConnection(from);

      if (candidate) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }

    function handlePeerLeft({ peerId }: { peerId: string }) {
      peerConnectionsRef.current.get(peerId)?.close();
      peerConnectionsRef.current.delete(peerId);
      peerIdsRef.current.delete(peerId);
      setRemoteStreams((current) => {
        const next = { ...current };
        delete next[peerId];
        return next;
      });
    }

    socket.on("webrtc:existing-peers", handleExistingPeers);
    socket.on("webrtc:peer-ready", handlePeerReady);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);
    socket.on("webrtc:peer-left", handlePeerLeft);
    socket.emit("webrtc:ready");

    return () => {
      socket.off("webrtc:existing-peers", handleExistingPeers);
      socket.off("webrtc:peer-ready", handlePeerReady);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      socket.off("webrtc:peer-left", handlePeerLeft);
    };
  }, [currentPlayerId, room.code, room.status, socket]);

  useEffect(() => {
    if (room.status !== "challenge") {
      const timeout = window.setTimeout(() => setIsRavoLoading(false), 0);

      return () => window.clearTimeout(timeout);
    }
  }, [room.status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTyping) {
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setSettings((current) => ({
          userScale: getNextScale(current.userScale, -1),
        }));
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setSettings((current) => ({
          userScale: getNextScale(current.userScale, 1),
        }));
      }

      if (event.key === "0") {
        event.preventDefault();
        setSettings({ userScale: getDefaultUserScale() });
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleCardClick(cardId: string) {
    if (!canPlayCard || isPlayLoading) {
      return;
    }

    const card = hand.find((nextCard) => nextCard.id === cardId);
    setSelectedCardId(cardId);
    setPlayAnimationCard(card ?? null);
    setIsPlayLoading(true);
    onPlayCard(cardId);

    window.setTimeout(() => {
      setIsPlayLoading(false);
      setPlayAnimationCard(null);
      setSelectedCardId(null);
    }, 650);
  }

  function handlePlaySelected() {
    if (!selectedCardId || !canPlayCard) {
      return;
    }

    onPlayCard(selectedCardId);
    setSelectedCardId(null);
  }

  function handleDrawCardClick() {
    if (!canDrawCard || isDrawLoading) {
      return;
    }

    console.log("draw card - reveal state unchanged");
    console.log("pendingPlayedCard", room.pendingPlayedCard);
    console.log("revealedCard", null);
    console.log("lastRevealedCard", room.lastRevealedCard);
    setIsDrawLoading(true);
    setDrawAnimationKey((current) => current + 1);
    onDrawCard();

    window.setTimeout(() => {
      setIsDrawLoading(false);
    }, 650);
  }

  function handleRavoClick() {
    if (!canCallRavo || isRavoLoading) {
      return;
    }

    setIsRavoLoading(true);
    onCallRavo();
  }

  async function handleToggleCamera() {
    setCameraError("");

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
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

      setCameraStream(stream);
    } catch {
      setCameraError("Camera permission was blocked.");
    }
  }

  async function handleToggleMic() {
    setCameraError("");

    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      setMicStream(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      setMicStream(stream);
    } catch {
      setCameraError("Microphone permission was blocked.");
    }
  }

  function handleToggleSound() {
    setIsSoundOn((current) => !current);
  }

  async function handleCopyRoomCode() {
    await navigator.clipboard.writeText(room.code);
    setRoomCodeCopyText("Copied!");

    window.setTimeout(() => {
      setRoomCodeCopyText("Copy Code");
    }, 2000);
  }

  function handleSendChat() {
    const trimmedMessage = chatDraft.trim();

    if (!trimmedMessage) {
      return;
    }

    const localMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      message: trimmedMessage,
      playerId: currentPlayerId,
      playerName: me?.name ?? "You",
      sentAt: Date.now(),
    };

    setLocalChatMessages((current) => [...current.slice(-20), localMessage]);
    onSendChat(trimmedMessage);
    setChatDraft("");
  }

  function handleBackHome() {
    const shouldLeave =
      room.status === "finished" ||
      window.confirm("Leave this game and return to the home page?");

    if (shouldLeave) {
      window.location.href = "/";
    }
  }

  return (
    <main className="game-shell">
      <div
        className="game-scale-wrapper"
        style={{ "--stage-scale": stageScale } as CSSProperties}
      >
        <div className="game-stage">
          <aside className="ravo-left-sidebar">
            <div>
              <h1 className="ravo-logo">
                RAVO<span>made by Dorodini</span>
              </h1>

              <div className="ravo-side-card">
                <p>Room Code</p>
                <strong>{room.code}</strong>
                <button
                  type="button"
                  onClick={handleCopyRoomCode}
                  className={`copy-code-button premium-button ravo-room-copy ${
                    roomCodeCopyText === "Copied!" ? "copied" : ""
                  }`}
                >
                  {roomCodeCopyText}
                </button>
              </div>

              <div className="ravo-side-card compact">
                <p>Round</p>
                <strong>{room.roundNumber}</strong>
              </div>

              <button type="button" className="ravo-back-home" onClick={handleBackHome}>
                Back to home
              </button>
            </div>

          </aside>

          <section className="ravo-table-area">
            <div className="ravo-oval-table">
              <div className="ravo-table-ring outer" />
              <div className="ravo-table-ring inner" />
              <div className="ravo-table-mask">RAVO</div>

              <div className="ravo-number-panel">
                <p>Next Number</p>
                <strong>{room.expectedNumber}</strong>
              </div>

              <div className="ravo-center-piles">
                <button
                  type="button"
                  disabled={!canDrawCard || isDrawLoading}
                  onClick={handleDrawCardClick}
                  className="ravo-pile ravo-draw-pile"
                  aria-label="Draw card"
                >
                  <PileStack />
                  <CardImage faceDown className="ravo-table-card ravo-card-draw" />
                </button>

                <div className="ravo-revealed-center">
                  {room.pendingPlayedCard ? (
                    <>
                      <CardImage faceDown className="ravo-center-revealed-card pending" />
                      <strong>FACE DOWN</strong>
                      <span>RAVO window open</span>
                    </>
                  ) : room.lastRevealedCard ? (
                    <>
                      {revealedCardVisible ? (
                        <div className="gold-particles" aria-hidden="true">
                          {Array.from({ length: 10 }).map((_, index) => (
                            <span key={index} />
                          ))}
                        </div>
                      ) : null}
                      <CardImage card={room.lastRevealedCard} className="ravo-center-revealed-card" />
                      <strong>REVEALED: {lastPlayedRevealedLabel}</strong>
                      <span>{revealStatus}</span>
                    </>
                  ) : (
                    <>
                      <div className="ravo-center-empty-card">RAVO</div>
                      <strong>WAITING</strong>
                      <span>No card played</span>
                    </>
                  )}
                </div>

                <div className="ravo-pile ravo-discard-pile">
                  <PileStack />
                  {room.lastRevealedCard ? (
                    <CardImage
                      card={room.lastRevealedCard}
                      className="ravo-table-card"
                    />
                  ) : (
                    <CardImage faceDown className="ravo-table-card" />
                  )}
                </div>
              </div>
            </div>
          </section>

          {seats.map((seat) => (
            <OpponentSeat
              key={seat.key}
              seat={seat}
              isTurn={seat.player.id === room.currentTurnPlayerId}
              remoteStream={remoteStreams[seat.player.id] ?? null}
            />
          ))}

          <aside className="ravo-last-played">
            <p>Last Played By</p>
            <strong>{lastPlayedBy?.name ?? "None"}</strong>
            <p>Claimed</p>
            <strong>{room.lastClaimedNumber ?? "-"}</strong>
            <p>Revealed</p>
            <strong>{lastPlayedRevealedLabel ?? "-"}</strong>
            <p>Status</p>
            <em>{room.lastRevealedCard ? (room.lastRevealWasChallenged ? "RAVO Called" : "Not Challenged") : "Waiting"}</em>
            {error ? <small>{error}</small> : null}
          </aside>

          <aside className="ravo-my-camera">
            <LocalCamera
              cameraError={cameraError}
              cameraStream={cameraStream}
              compact
              isCameraOn={isCameraOn}
              isMicOn={isMicOn}
            />
            <div className="ravo-camera-controls">
              <span className={isMicOn ? "status-on" : "status-off"}>Mic: {isMicOn ? "On" : "Off"}</span>
              <span className={isCameraOn ? "status-on" : "status-off"}>Camera: {isCameraOn ? "On" : "Off"}</span>
            </div>
          </aside>

          <section className="ravo-player-hand" aria-label="Your hand">
            <div className="ravo-hand-stage">
              {hand.map((card, index) => {
                const isSelected = selectedCardId === card.id;

                return (
                    <button
                      type="button"
                      key={card.id}
                      disabled={!canPlayCard || isPlayLoading}
                    onClick={() => handleCardClick(card.id)}
                    style={getHandCardStyle(index, hand.length, isSelected)}
                    className={`ravo-hand-card ${isSelected ? "selected" : ""}`}
                    aria-label={`Select ${getCardLabel(card)}`}
                  >
                    <CardImage card={card} className="ravo-hand-card-image" />
                  </button>
                );
              })}
            </div>

            <div className="ravo-hand-label">
              <span>^</span>
              <strong>You</strong>
              <small>
                {me?.name ?? "Player"} - {hand.length} cards
              </small>
              {room.status === "bluff-extra" && room.bluffExtraPlayerId === currentPlayerId ? (
                <em className="ravo-bluff-extra-note">
                  BLUFF SUCCESS - play {room.bluffExtraRemaining} extra cards
                </em>
              ) : null}
              {selectedCard ? (
                <button type="button" disabled={!canPlayCard} onClick={handlePlaySelected}>
                  Play {getCardLabel(selectedCard)}
                </button>
              ) : null}
            </div>
          </section>

          <aside className="ravo-right-sidebar">
            <div className="ravo-top-icons" aria-label="Quick controls">
              <button type="button" aria-label="Sound" onClick={handleToggleSound} className={isSoundOn ? "active" : ""}>
                {isSoundOn ? "SND" : "MUTE"}
              </button>
              <button type="button" aria-label="Chat" onClick={() => setIsChatOpen((current) => !current)}>
                CHAT
              </button>
              <button type="button" aria-label="Settings" onClick={() => setIsSettingsOpen(true)}>
                SET
              </button>
            </div>

            <div className="ravo-actions">
              <button
                type="button"
                disabled={!canCallRavo || isRavoLoading}
                onClick={handleRavoClick}
                className={`ravo-action primary premium-particles ${canCallRavo ? "active" : ""}`}
              >
                <span>RAVO!</span>
                <small>{didYouCallRavo || isRavoLoading ? "Called" : "Challenge"}</small>
              </button>
              <button
                type="button"
                disabled={!canDrawCard || isDrawLoading}
                onClick={handleDrawCardClick}
                className="ravo-action"
              >
                <span>Draw Card</span>
                <small>{isDrawLoading ? "Drawing..." : "Skip your turn"}</small>
              </button>
              <button type="button" className={`ravo-action status-action ${isCameraOn ? "status-on" : "status-off"}`} onClick={handleToggleCamera}>
                <span>Camera: {isCameraOn ? "On" : "Off"}</span>
                <small>{isCameraOn ? "Click to stop" : "Request camera"}</small>
              </button>
              <button type="button" className={`ravo-action status-action ${isMicOn ? "status-on" : "status-off"}`} onClick={handleToggleMic}>
                <span>Mic: {isMicOn ? "On" : "Off"}</span>
                <small>{isMicOn ? "Click to stop" : "Request mic"}</small>
              </button>
              <button type="button" className="ravo-action" onClick={() => setIsSettingsOpen(true)}>
                <span>Settings</span>
                <small>Display and scale</small>
              </button>
            </div>
          </aside>

          {drawAnimationKey > 0 && isDrawLoading ? (
            <CardImage key={drawAnimationKey} faceDown className="draw-flight-card" />
          ) : null}

          {playAnimationCard ? <CardImage faceDown className="play-flight-card" /> : null}

          {room.status === "challenge" ? (
            <div className="ravo-countdown-panel">
              <strong>RAVO time: {countdownSeconds}</strong>
              <span>Challenge the face-down card now</span>
            </div>
          ) : null}

          {revealedCardVisible && room.lastRevealedCard ? (
            <div className="ravo-reveal-overlay">
              <div className="ravo-reveal-card">
                <div className="ravo-reveal-card-inner">
                  <CardImage faceDown className="ravo-reveal-face back" />
                  <CardImage card={room.lastRevealedCard} className="ravo-reveal-face front" />
                </div>
              </div>
              <strong>
                REVEALED: {room.lastRevealedCardLabel ?? getCardLabel(room.lastRevealedCard)}
              </strong>
            </div>
          ) : null}

          {isChatOpen ? (
            <section className="ravo-chat-panel">
              <div className="ravo-chat-header">
                <strong>Chat</strong>
                <button type="button" onClick={() => setIsChatOpen(false)}>
                  Close
                </button>
              </div>
              <ul>
                {visibleChatMessages.slice(-8).map((message) => (
                  <li key={message.id}>
                    <strong>{message.playerName}</strong>
                    <span>{message.message}</span>
                  </li>
                ))}
              </ul>
              <div className="ravo-chat-form">
                <input
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSendChat();
                    }
                  }}
                  placeholder="Type message..."
                />
                <button type="button" onClick={handleSendChat}>
                  Send
                </button>
              </div>
            </section>
          ) : null}

          {room.status === "challenge" ? (
            <div className="ravo-challenge-overlay">
              <span>RAVO Challenge</span>
            </div>
          ) : null}

          {room.status === "finished" ? (
            <div className="ravo-win">
              <div>
                <p>Game Over</p>
                <h2>{winner?.name ?? "A player"} wins</h2>
                <button type="button" onClick={onPlayAgain}>
                  Play Again
                </button>
              </div>
            </div>
          ) : null}

          {isSettingsOpen ? (
            <DisplaySettingsPanel
              stageScale={stageScale}
              onClose={() => setIsSettingsOpen(false)}
              onReset={() => setSettings({ userScale: getDefaultUserScale() })}
              onUpdate={(userScale) => setSettings({ userScale })}
              userScale={settings.userScale}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function DisplaySettingsPanel({
  onClose,
  onReset,
  onUpdate,
  stageScale,
  userScale,
}: {
  onClose: () => void;
  onReset: () => void;
  onUpdate: (userScale: number) => void;
  stageScale: number;
  userScale: number;
}) {
  return (
    <div className="display-settings-backdrop">
      <section className="display-settings-panel" aria-label="Display settings">
        <div className="display-settings-header">
          <div>
            <p>Display Settings</p>
            <h2>Canvas Fit</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="display-settings-readout">
          <span>Design: 1600 x 900</span>
          <span>Stage fit: {Math.round(stageScale * 100)}%</span>
          <span>UI pref: {Math.round(userScale * 100)}%</span>
        </div>

        <div className="display-settings-section">
          <p>UI Scale</p>
          <div className="display-settings-options">
            {SCALE_OPTIONS.map((scale) => (
              <button
                type="button"
                key={scale}
                className={userScale === scale ? "active" : ""}
                onClick={() => onUpdate(scale)}
              >
                {Math.round(scale * 100)}%
              </button>
            ))}
          </div>
        </div>

        <div className="display-settings-hints">
          <p>Hotkeys</p>
          <span>Minus: scale down</span>
          <span>Plus: scale up</span>
          <span>0: reset scale</span>
        </div>

        <button type="button" className="display-settings-reset" onClick={onReset}>
          Reset Display Defaults
        </button>
      </section>
    </div>
  );
}

function OpponentSeat({
  isTurn,
  remoteStream,
  seat,
}: {
  isTurn: boolean;
  remoteStream: MediaStream | null;
  seat: OpponentSeat;
}) {
  const player = seat.player;
  const cameraClass = player.cameraOn ? "camera-on" : "camera-off";
  const micClass = player.micOn ? "mic-on" : "mic-off";

  return (
    <div className={`ravo-opponent-zone ${seat.className} ${isTurn ? "active" : ""} ${cameraClass} ${micClass}`}>
      <div className="ravo-opponent-camera">
        <span>{player.name}</span>
        {remoteStream && player.cameraOn ? (
          <RemoteVideo stream={remoteStream} />
        ) : (
          <div>CAMERA OFF</div>
        )}
        {remoteStream && player.micOn ? <RemoteAudio stream={remoteStream} /> : null}
      </div>
      <div className="ravo-opponent-cards">
        {Array.from({ length: Math.max(1, Math.min(7, player.cardCount ?? 0)) }).map((_, index) => (
          <CardImage key={index} faceDown className="ravo-opponent-card-back" />
        ))}
      </div>
      <div className="ravo-opponent-meta">
        <strong>{player.cardCount ?? 0} CARDS</strong>
        <span className={player.micOn ? "status-dot on" : "status-dot off"} />
      </div>
    </div>
  );
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="ravo-remote-video"
    />
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay />;
}

function PileStack() {
  return (
    <>
      <div className="ravo-pile-shadow one" />
      <div className="ravo-pile-shadow two" />
      <div className="ravo-pile-shadow three" />
    </>
  );
}
