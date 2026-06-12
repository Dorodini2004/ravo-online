export type Player = {
  cardCount?: number;
  cameraOn?: boolean;
  id: string;
  micOn?: boolean;
  name: string;
};

export type NumberCard = {
  id: string;
  type: "number";
  value: number;
};

export type RavoJokerCard = {
  id: string;
  type: "ravo-joker";
};

export type BluffCard = {
  id: string;
  type: "bluff";
};

export type Card = NumberCard | RavoJokerCard | BluffCard;

export type Room = {
  challengeEndsAt: number | null;
  code: string;
  currentTurnPlayerId: string | null;
  discardPileCount: number;
  drawPileCount: number;
  expectedNumber: number;
  bluffExtraPlayerId: string | null;
  bluffExtraRemaining: number;
  hostId: string;
  lastAnnouncement: string | null;
  lastPlayedBy: string | null;
  lastPlayedCard: Card | null;
  lastClaimedNumber: number | null;
  lastRevealedCardLabel: string | null;
  lastRevealedAt: number | null;
  lastRevealedCard: Card | null;
  lastRevealCallers: string[];
  log: string[];
  lastRevealWasChallenged: boolean;
  pendingPlayedCard: Card | null;
  pendingRavoCallers: string[];
  players: Player[];
  roundNumber: number;
  status: "waiting" | "playing" | "challenge" | "bluff-extra" | "finished";
  winnerId: string | null;
};

export type RoomResponse =
  | {
      ok: true;
      room: Room;
    }
  | {
      ok: false;
      error: string;
    };

export type GameStartedPayload = {
  room: Room;
  hand: Card[];
};

export type GameStatePayload = {
  room: Room;
  hand: Card[];
};

export type ChatMessage = {
  id: string;
  message: string;
  playerId: string;
  playerName: string;
  sentAt: number;
};
