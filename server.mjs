import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const challengeWindowMs = 5000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const rooms = new Map();

export function createPlayableDeck() {
  const deck = [];

  for (let value = 1; value <= 9; value += 1) {
    for (let copy = 1; copy <= 9; copy += 1) {
      deck.push({ id: `number-${value}-${copy}`, type: "number", value });
    }
  }

  for (let copy = 1; copy <= 6; copy += 1) {
    deck.push({ id: `ravo-joker-${copy}`, type: "ravo-joker" });
  }

  for (let copy = 1; copy <= 3; copy += 1) {
    deck.push({ id: `bluff-${copy}`, type: "bluff" });
  }

  return deck;
}

function shuffleDeck(deck) {
  const shuffledDeck = [...deck];

  for (let index = shuffledDeck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledDeck[index], shuffledDeck[swapIndex]] = [
      shuffledDeck[swapIndex],
      shuffledDeck[index],
    ];
  }

  return shuffledDeck;
}

function createRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  return rooms.has(code) ? createRoomCode() : code;
}

function getCardLabel(card) {
  if (!card) {
    return "Unknown card";
  }

  if (card.type === "number") {
    return card.value.toString();
  }

  if (card.type === "ravo-joker") {
    return "RAVO";
  }

  return "BLUFF";
}

export function isTruthfulPlay(card, announcedNumber) {
  if (card.type === "ravo-joker") {
    return true;
  }

  return card.value === announcedNumber;
}

export function getPublicRoom(room) {
  const players = Array.from(room.players.values()).map((player) => ({
    ...player,
    cardCount: room.hands.get(player.id)?.length ?? 0,
    cameraOn: room.mediaStatus.get(player.id)?.cameraOn ?? false,
    micOn: room.mediaStatus.get(player.id)?.micOn ?? false,
  }));

  return {
    bluffExtraPlayerId: room.bluffExtraPlayerId,
    bluffExtraRemaining: room.bluffExtraRemaining,
    challengeEndsAt: room.challengeEndsAt,
    code: room.code,
    currentTurnPlayerId: room.currentTurnPlayerId,
    discardPileCount: room.discardPile.length,
    drawPileCount: room.drawPile.length,
    expectedNumber: room.expectedNumber,
    hostId: room.hostId,
    lastClaimedNumber: room.pendingPlay?.announcedNumber ?? room.lastClaimedNumber,
    lastAnnouncement: room.lastAnnouncement,
    lastPlayedCard: room.pendingPlay ? null : room.lastPlayedCard,
    lastPlayedBy: room.lastPlayedBy,
    lastRevealedAt: room.lastRevealedAt,
    lastRevealedCard: room.lastRevealedCard,
    lastRevealedCardLabel: room.lastRevealedCardLabel,
    lastRevealCallers: room.lastRevealCallers,
    lastRevealWasChallenged: room.lastRevealWasChallenged,
    log: room.log.slice(-8),
    pendingRavoCallers: Array.from(room.pendingRavoCallers),
    pendingPlayedCard: Boolean(room.pendingPlay),
    pendingPenalty: room.pendingPenalty
      ? { count: room.pendingPenalty.count, playerId: room.pendingPenalty.playerId }
      : null,
    players,
    roundNumber: room.roundNumber,
    startingPlayerId: room.startingPlayerId,
    status: room.status,
    winnerId: room.winnerId,
  };
}

export function getNextExpectedNumber(currentNumber) {
  return currentNumber === 9 ? 1 : currentNumber + 1;
}

function getNextPlayerId(room, fromPlayerId = room.currentTurnPlayerId) {
  const players = Array.from(room.players.values());
  const currentIndex = players.findIndex((player) => player.id === fromPlayerId);
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (safeCurrentIndex + 1) % players.length;

  return players[nextIndex].id;
}

function advanceTurn(room, fromPlayerId) {
  const nextPlayerId = getNextPlayerId(room, fromPlayerId);
  room.currentTurnPlayerId = nextPlayerId;
  if (nextPlayerId === room.startingPlayerId) room.roundNumber += 1;
  return nextPlayerId;
}

function addLog(room, message) {
  room.log.push(message);
}

export function drawCards(room, playerId, count) {
  const hand = room.hands.get(playerId) ?? [];
  let drawnCount = 0;

  for (let index = 0; index < count; index += 1) {
    if (room.drawPile.length === 0) refillDrawPile(room);
    const card = room.drawPile.shift();

    if (!card) {
      break;
    }

    hand.push(card);
    drawnCount += 1;
  }

  room.hands.set(playerId, hand);
  return drawnCount;
}

export function refillDrawPile(room) {
  if (room.discardPile.length <= 1) return 0;

  const topDiscard = room.discardPile.at(-1);
  const recycledCards = room.discardPile.slice(0, -1).map((play) => play.card);
  room.discardPile = [topDiscard];
  room.drawPile.push(...shuffleDeck(recycledCards));
  addLog(room, `${recycledCards.length} discarded cards were reshuffled into the draw pile.`);
  return recycledCards.length;
}

function ensureCardsAvailable(room, count) {
  if (room.drawPile.length >= count) return true;
  refillDrawPile(room);
  return room.drawPile.length >= count;
}

function applyPenalty(room, playerId, count) {
  if (!ensureCardsAvailable(room, count)) {
    room.pendingPenalty = { count, playerId };
    room.status = "draw-pile-empty";
    addLog(
      room,
      `Game paused: ${count} penalty cards are owed, but only ${room.drawPile.length} remain.`,
    );
    return false;
  }

  drawCards(room, playerId, count);
  return true;
}

function checkWinner(room, playerId) {
  const hand = room.hands.get(playerId) ?? [];

  if (hand.length === 0) {
    room.status = "finished";
    room.winnerId = playerId;
    room.currentTurnPlayerId = null;
    addLog(room, `${room.players.get(playerId)?.name ?? "A player"} won the game.`);
    return true;
  }

  return false;
}

export function resetGameRound(room, selectStartingPlayer = Math.random) {
  room.status = "playing";
  const playerIds = Array.from(room.players.keys());
  const startIndex = Math.min(playerIds.length - 1, Math.floor(selectStartingPlayer() * playerIds.length));
  room.startingPlayerId = playerIds[startIndex];
  room.currentTurnPlayerId = room.startingPlayerId;
  room.expectedNumber = 1;
  room.hands.clear();
  room.lastAnnouncement = null;
  room.lastClaimedNumber = null;
  room.lastPlayedCard = null;
  room.lastPlayedBy = null;
  room.lastRevealedAt = null;
  room.lastRevealedCard = null;
  room.lastRevealedCardLabel = null;
  room.lastRevealCallers = [];
  room.lastRevealWasChallenged = false;
  room.pendingPlay = null;
  room.pendingPenalty = null;
  room.pendingRavoCallers.clear();
  room.bluffExtraPlayerId = null;
  room.bluffExtraRemaining = 0;
  room.roundNumber = 1;
  room.challengeEndsAt = null;
  room.winnerId = null;
  room.discardPile = [];
  room.drawPile = shuffleDeck(createPlayableDeck());
  clearChallengeTimer(room);

  for (const player of room.players.values()) {
    room.hands.set(player.id, room.drawPile.splice(0, 8));
  }
}

function clearChallengeTimer(room) {
  if (room.challengeTimer) {
    clearTimeout(room.challengeTimer);
    room.challengeTimer = null;
  }
}

export function emitPrivateGameState(io, room) {
  for (const player of room.players.values()) {
    io.to(player.id).emit("game:state", {
      room: getPublicRoom(room),
      hand: room.hands.get(player.id) ?? [],
    });
  }
}

export function finishPendingPlay(io, room) {
  if (!room.pendingPlay || room.status !== "challenge") {
    return;
  }

  clearChallengeTimer(room);
  room.status = "resolving";

  const pendingPlay = room.pendingPlay;
  const callers = Array.from(room.pendingRavoCallers);
  const playedByName = room.players.get(pendingPlay.playerId)?.name ?? "A player";
  const isTruthful = isTruthfulPlay(pendingPlay.card, pendingPlay.announcedNumber);
  const isBluffCard = pendingPlay.card.type === "bluff";
  const nextTurnPlayerId = getNextPlayerId(room, pendingPlay.playerId);
  let startsBluffExtra = false;
  let penaltyPaid = true;

  console.log("revealing card:", pendingPlay.card);

  room.lastRevealedCard = pendingPlay.card;
  room.lastRevealedAt = Date.now();
  room.lastRevealedCardLabel = getCardLabel(pendingPlay.card);
  room.lastRevealCallers = callers.map((callerId) => room.players.get(callerId)?.name ?? "A caller");
  room.lastRevealWasChallenged = callers.length > 0;

  addLog(room, "RAVO time ended.");
  addLog(room, `Played card revealed: ${getCardLabel(pendingPlay.card)}.`);
  io.to(room.code).emit("game:card-revealed", {
    card: pendingPlay.card,
    label: getCardLabel(pendingPlay.card),
    playerId: pendingPlay.playerId,
    revealedAt: room.lastRevealedAt,
  });

  if (callers.length === 0) {
    addLog(room, `${playedByName}'s card was not challenged.`);
  } else if (isBluffCard) {
    startsBluffExtra = true;
    addLog(room, `BLUFF SUCCESS - ${playedByName} may play 2 extra cards.`);
    io.to(room.code).emit("game:bluff-success", {
      playerId: pendingPlay.playerId,
      playerName: playedByName,
      extraCards: 2,
    });
  } else {
    const callerId = callers[0];
    const callerName = room.players.get(callerId)?.name ?? "A caller";

    if (isTruthful) {
      penaltyPaid = applyPenalty(room, callerId, 2);
      if (penaltyPaid) {
        addLog(room, `${callerName} called RAVO incorrectly and drew 2 cards.`);
      }
    } else {
      penaltyPaid = applyPenalty(room, pendingPlay.playerId, 2);
      if (penaltyPaid) {
        addLog(room, `${playedByName} was caught bluffing and drew 2 cards.`);
      }
    }
  }

  const didPlayedPlayerWin = penaltyPaid && checkWinner(room, pendingPlay.playerId);

  if (penaltyPaid && !didPlayedPlayerWin) {
    if (startsBluffExtra) {
      room.status = "bluff-extra";
      room.currentTurnPlayerId = pendingPlay.playerId;
      room.bluffExtraPlayerId = pendingPlay.playerId;
      room.bluffExtraRemaining = 2;
      addLog(room, "BLUFF SUCCESS - play 2 extra cards.");
    } else {
      room.status = "playing";
      room.currentTurnPlayerId = nextTurnPlayerId;
      addLog(room, `${room.players.get(nextTurnPlayerId)?.name ?? "Next player"}'s turn started.`);

      if (nextTurnPlayerId === room.startingPlayerId) room.roundNumber += 1;

      room.expectedNumber = getNextExpectedNumber(room.expectedNumber);
    }
  }

  room.pendingPlay = null;
  room.pendingRavoCallers.clear();
  room.challengeEndsAt = null;

  emitPrivateGameState(io, room);
}

export function playBluffExtraCard(room, playerId, cardId) {
  if (
    room.status !== "bluff-extra" ||
    room.currentTurnPlayerId !== playerId ||
    room.bluffExtraPlayerId !== playerId ||
    room.bluffExtraRemaining <= 0
  ) {
    return { ok: false, error: "You cannot play extra BLUFF cards right now." };
  }

  const hand = room.hands.get(playerId) ?? [];
  const cardIndex = hand.findIndex((card) => card.id === cardId);

  if (cardIndex === -1) {
    return { ok: false, error: "That card is not in your hand." };
  }

  const [playedCard] = hand.splice(cardIndex, 1);
  room.discardPile.push({ announcedNumber: null, card: playedCard, playerId });
  room.bluffExtraRemaining -= 1;

  const didWin = checkWinner(room, playerId);

  if (!didWin && room.bluffExtraRemaining <= 0) {
    finishBluffExtra(room, playerId);
  }

  return { didWin, ok: true, playedCard };
}

export function finishBluffExtra(room, playerId) {
  if (
    room.status !== "bluff-extra" ||
    room.currentTurnPlayerId !== playerId ||
    room.bluffExtraPlayerId !== playerId
  ) {
    return { ok: false, error: "You cannot end BLUFF bonus cards right now." };
  }

  advanceTurn(room, playerId);
  room.status = "playing";
  room.bluffExtraPlayerId = null;
  room.bluffExtraRemaining = 0;
  room.expectedNumber = getNextExpectedNumber(room.expectedNumber);
  return { ok: true };
}

export function drawTurnCard(room, playerId) {
  if (room.status !== "playing" || room.currentTurnPlayerId !== playerId) {
    return { ok: false, error: "You cannot draw right now." };
  }

  if (drawCards(room, playerId, 1) !== 1) {
    return { ok: false, error: "The draw pile is empty." };
  }

  advanceTurn(room, playerId);
  room.expectedNumber = getNextExpectedNumber(room.expectedNumber);
  return { ok: true };
}

export function registerRavoCall(room, callerId, now = Date.now()) {
  if (room.status !== "challenge" || !room.pendingPlay) {
    return { ok: false, error: "There is no card to challenge right now." };
  }
  if (!room.challengeEndsAt || now > room.challengeEndsAt) {
    return { ok: false, error: "The RAVO window has ended." };
  }
  if (room.pendingPlay.playerId === callerId) {
    return { ok: false, error: "You cannot call RAVO on your own card." };
  }
  if (room.pendingRavoCallers.size > 0 || room.pendingRavoCallers.has(callerId)) {
    return { ok: false, error: "This play has already been challenged." };
  }
  room.pendingRavoCallers.add(callerId);
  return { ok: true };
}

export function createRoom(socket, roomCode) {
  return {
    challengeEndsAt: null,
    challengeTimer: null,
    bluffExtraPlayerId: null,
    bluffExtraRemaining: 0,
    code: roomCode,
    currentTurnPlayerId: null,
    expectedNumber: 1,
    hostId: socket.id,
    lastAnnouncement: null,
    lastClaimedNumber: null,
    lastPlayedCard: null,
    lastPlayedBy: null,
    lastRevealedAt: null,
    lastRevealedCard: null,
    lastRevealedCardLabel: null,
    lastRevealCallers: [],
    lastRevealWasChallenged: false,
    log: [],
    pendingPlay: null,
    pendingPenalty: null,
    pendingRavoCallers: new Set(),
    players: new Map(),
    mediaStatus: new Map(),
    roundNumber: 1,
    hands: new Map(),
    status: "waiting",
    startingPlayerId: null,
    drawPile: [],
    discardPile: [],
    winnerId: null,
  };
}

export async function startServer() {
  await app.prepare();
  const httpServer = createServer(handle);
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.emit("server:welcome", {
      message: "Connected to RAVO server",
      socketId: socket.id,
    });

    socket.on("room:create", ({ playerName }, callback) => {
      const trimmedName = playerName.trim();

      if (!trimmedName) {
        callback({ ok: false, error: "Enter your name before creating a room." });
        return;
      }

      const roomCode = createRoomCode();
      const room = createRoom(socket, roomCode);
      const player = { id: socket.id, name: trimmedName };

      room.players.set(socket.id, player);
      room.mediaStatus.set(socket.id, { cameraOn: false, micOn: false });
      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.playerName = trimmedName;

      addLog(room, `${trimmedName} created the room.`);

      callback({ ok: true, room: getPublicRoom(room) });
      emitPrivateGameState(io, room);
    });

    socket.on("room:join", ({ playerName, roomCode }, callback) => {
      const trimmedName = playerName.trim();
      const normalizedRoomCode = roomCode.trim().toUpperCase();

      if (!trimmedName) {
        callback({ ok: false, error: "Enter your name before joining a room." });
        return;
      }

      if (!normalizedRoomCode) {
        callback({ ok: false, error: "Enter a room code." });
        return;
      }

      const room = rooms.get(normalizedRoomCode);

      if (!room) {
        callback({ ok: false, error: "Room not found. Check the code and try again." });
        return;
      }

      if (room.status !== "waiting") {
        callback({ ok: false, error: "This game has already started." });
        return;
      }

      if (room.players.size >= 8) {
        callback({ ok: false, error: "This room is full." });
        return;
      }

      const player = { id: socket.id, name: trimmedName };

      room.players.set(socket.id, player);
      room.mediaStatus.set(socket.id, { cameraOn: false, micOn: false });
      socket.join(normalizedRoomCode);
      socket.data.roomCode = normalizedRoomCode;
      socket.data.playerName = trimmedName;
      addLog(room, `${trimmedName} joined the room.`);

      callback({ ok: true, room: getPublicRoom(room) });
      emitPrivateGameState(io, room);
    });

    socket.on("game:start", (callback) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room) {
        callback({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      if (room.hostId !== socket.id) {
        callback({ ok: false, error: "Only the host can start the game." });
        return;
      }

      if (room.players.size < 2) {
        callback({ ok: false, error: "You need at least 2 players to start." });
        return;
      }

      if (room.status !== "waiting") {
        callback({ ok: false, error: "The game has already started." });
        return;
      }

      resetGameRound(room);

      addLog(
        room,
        `The game started. Each player received 8 cards. ${room.players.get(room.startingPlayerId)?.name ?? "A randomly selected player"} starts with number 1.`,
      );
      callback({ ok: true, room: getPublicRoom(room) });
      emitPrivateGameState(io, room);
    });

    socket.on("game:play-card", ({ cardId }, callback) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room) {
        callback({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      if (room.status !== "playing" && room.status !== "bluff-extra") {
        callback({ ok: false, error: "You cannot play a card right now." });
        return;
      }

      if (room.currentTurnPlayerId !== socket.id) {
        callback({ ok: false, error: "It is not your turn." });
        return;
      }

      const hand = room.hands.get(socket.id) ?? [];
      const cardIndex = hand.findIndex((card) => card.id === cardId);

      if (cardIndex === -1) {
        callback({ ok: false, error: "That card is not in your hand." });
        return;
      }

      if (room.status === "bluff-extra") {
        const result = playBluffExtraCard(room, socket.id, cardId);

        if (!result.ok) {
          callback(result);
          return;
        }

        room.lastAnnouncement = "BLUFF SUCCESS - extra card played face-down.";
        addLog(room, `${socket.data.playerName} played an extra BLUFF success card.`);
        io.to(room.code).emit("game:bluff-extra-card-played", {
          playerId: socket.id,
          remaining: room.bluffExtraRemaining,
        });

        if (!result.didWin && room.status === "playing") {
          addLog(room, `${room.players.get(room.currentTurnPlayerId)?.name ?? "Next player"}'s turn started.`);
        }

        callback({ ok: true, room: getPublicRoom(room) });
        emitPrivateGameState(io, room);
        return;
      }

      const [playedCard] = hand.splice(cardIndex, 1);
      console.log("played card:", playedCard);
      room.hands.set(socket.id, hand);

      room.discardPile.push({
        announcedNumber: room.expectedNumber,
        card: playedCard,
        playerId: socket.id,
      });
      room.lastAnnouncement = `${socket.data.playerName} announced ${room.expectedNumber}`;
      room.lastClaimedNumber = room.expectedNumber;
      room.lastPlayedCard = playedCard;
      room.lastPlayedBy = socket.id;
      room.lastRevealedAt = null;
      room.lastRevealCallers = [];
      room.lastRevealWasChallenged = false;
      room.pendingPlay = {
        announcedNumber: room.expectedNumber,
        card: playedCard,
        playerId: socket.id,
      };
      room.pendingRavoCallers.clear();
      room.challengeEndsAt = Date.now() + challengeWindowMs;

      addLog(
        room,
        `${socket.data.playerName} played a face-down card and announced ${room.expectedNumber}.`,
      );
      addLog(room, `RAVO countdown started.`);

      room.status = "challenge";
      io.to(room.code).emit("game:card-played-face-down", {
        announcedNumber: room.expectedNumber,
        challengeEndsAt: room.challengeEndsAt,
        playerId: socket.id,
      });
      io.to(room.code).emit("game:ravo-window-started", {
        challengeEndsAt: room.challengeEndsAt,
        seconds: challengeWindowMs / 1000,
      });
      room.challengeTimer = setTimeout(() => {
        finishPendingPlay(io, room);
      }, challengeWindowMs);

      callback({ ok: true, room: getPublicRoom(room) });
      emitPrivateGameState(io, room);
    });

    socket.on("game:draw-card", (callback) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room) {
        callback({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      if (room.status !== "playing") {
        callback({ ok: false, error: "You cannot draw right now." });
        return;
      }

      if (room.currentTurnPlayerId !== socket.id) {
        callback({ ok: false, error: "It is not your turn." });
        return;
      }

      const result = drawTurnCard(room, socket.id);

      if (!result.ok) {
        callback(result);
        return;
      }

      addLog(room, `${socket.data.playerName} drew 1 card instead of playing.`);
      console.log("draw card - reveal state unchanged");
      console.log("pendingPlayedCard", room.pendingPlay?.card ?? null);
      console.log("revealedCard", null);
      console.log("lastRevealedCard", room.lastRevealedCard);
      callback({ ok: true, room: getPublicRoom(room) });
      emitPrivateGameState(io, room);
    });

    socket.on("game:finish-bluff-extra", (callback) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) {
        callback({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      const result = finishBluffExtra(room, socket.id);
      if (!result.ok) {
        callback(result);
        return;
      }

      addLog(room, `${socket.data.playerName} ended the BLUFF bonus.`);
      callback({ ok: true, room: getPublicRoom(room) });
      emitPrivateGameState(io, room);
    });

    socket.on("game:call-ravo", (callback) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room) {
        callback({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      if (!room.challengeEndsAt || Date.now() > room.challengeEndsAt) {
        finishPendingPlay(io, room);
        callback({ ok: false, error: "The RAVO window has ended." });
        return;
      }

      const result = registerRavoCall(room, socket.id);
      if (!result.ok) {
        callback(result);
        return;
      }
      addLog(room, `${socket.data.playerName} called RAVO.`);
      io.to(room.code).emit("game:ravo-called", {
        callerId: socket.id,
        callerName: socket.data.playerName,
      });

      callback({ ok: true, room: getPublicRoom(room) });
      finishPendingPlay(io, room);
    });

    socket.on("chat:send", ({ message }, callback) => {
      const room = rooms.get(socket.data.roomCode);
      const trimmedMessage = typeof message === "string" ? message.trim() : "";

      if (!room) {
        callback?.({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      if (!trimmedMessage) {
        callback?.({ ok: false, error: "Enter a message before sending." });
        return;
      }

      const chatMessage = {
        id: `${Date.now()}-${socket.id}`,
        message: trimmedMessage.slice(0, 180),
        playerId: socket.id,
        playerName: socket.data.playerName ?? "Player",
        sentAt: Date.now(),
      };

      addLog(room, `${chatMessage.playerName}: ${chatMessage.message}`);
      io.to(room.code).emit("chat:message", chatMessage);
      emitPrivateGameState(io, room);
      callback?.({ ok: true });
    });

    socket.on("lobbyChatMessage", ({ text }, callback) => {
      const room = rooms.get(socket.data.roomCode);
      const trimmedText = typeof text === "string" ? text.trim() : "";

      if (!room) {
        callback?.({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      if (!trimmedText) {
        callback?.({ ok: false, error: "Enter a message before sending." });
        return;
      }

      const chatMessage = {
        id: `${Date.now()}-${socket.id}`,
        message: trimmedText.slice(0, 180),
        playerId: socket.id,
        playerName: socket.data.playerName ?? "Player",
        sentAt: Date.now(),
      };

      io.to(room.code).emit("lobbyChatMessage", chatMessage);
      callback?.({ ok: true });
    });

    socket.on("game:play-again", (callback) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room) {
        callback?.({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      if (room.status !== "finished") {
        callback?.({ ok: false, error: "The current game is not finished." });
        return;
      }

      if (room.hostId !== socket.id) {
        callback?.({ ok: false, error: "Only the host can return the room to the lobby." });
        return;
      }

      room.status = "waiting";
      room.currentTurnPlayerId = null;
      room.startingPlayerId = null;
      room.expectedNumber = 1;
      room.hands.clear();
      room.lastAnnouncement = null;
      room.lastClaimedNumber = null;
      room.lastPlayedCard = null;
      room.lastPlayedBy = null;
      room.lastRevealedAt = null;
      room.lastRevealedCard = null;
      room.lastRevealedCardLabel = null;
      room.lastRevealCallers = [];
      room.lastRevealWasChallenged = false;
      room.pendingPlay = null;
      room.pendingPenalty = null;
      room.pendingRavoCallers.clear();
      room.bluffExtraPlayerId = null;
      room.bluffExtraRemaining = 0;
      room.roundNumber = 1;
      room.challengeEndsAt = null;
      room.winnerId = null;
      room.discardPile = [];
      room.drawPile = [];
      clearChallengeTimer(room);
      addLog(room, "Players returned to the lobby.");
      callback?.({ ok: true, room: getPublicRoom(room) });
      emitPrivateGameState(io, room);
      io.to(room.code).emit("game:returned-to-lobby", {
        room: getPublicRoom(room),
      });
      io.to(room.code).emit("room:updated", getPublicRoom(room));
    });

    socket.on("media:status", ({ cameraOn, micOn }) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room) {
        return;
      }

      room.mediaStatus.set(socket.id, {
        cameraOn: Boolean(cameraOn),
        micOn: Boolean(micOn),
      });
      io.to(room.code).emit("room:updated", getPublicRoom(room));
      emitPrivateGameState(io, room);
    });

    socket.on("media:video-frame", ({ frame }) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room || typeof frame !== "string" || frame.length > 180000) {
        return;
      }

      socket.to(room.code).emit("media:video-frame", {
        frame,
        playerId: socket.id,
      });
    });

    socket.on("media:audio-chunk", ({ chunk }) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room || typeof chunk !== "string" || chunk.length > 260000) {
        return;
      }

      socket.to(room.code).emit("media:audio-chunk", {
        chunk,
        playerId: socket.id,
      });
    });

    socket.on("webrtc:ready", () => {
      const room = rooms.get(socket.data.roomCode);

      if (!room) {
        return;
      }

      socket.to(room.code).emit("webrtc:peer-ready", {
        peerId: socket.id,
      });
      socket.emit("webrtc:existing-peers", {
        peerIds: Array.from(room.players.keys()).filter((playerId) => playerId !== socket.id),
      });
    });

    socket.on("webrtc:offer", ({ to, offer }) => {
      io.to(to).emit("webrtc:offer", {
        from: socket.id,
        offer,
      });
    });

    socket.on("webrtc:answer", ({ to, answer }) => {
      io.to(to).emit("webrtc:answer", {
        from: socket.id,
        answer,
      });
    });

    socket.on("webrtc:ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("webrtc:ice-candidate", {
        candidate,
        from: socket.id,
      });
    });

    socket.on("disconnect", () => {
      const room = rooms.get(socket.data.roomCode);

      if (room) {
        room.players.delete(socket.id);
        room.hands.delete(socket.id);
        room.mediaStatus.delete(socket.id);
        room.pendingRavoCallers.delete(socket.id);
        socket.to(room.code).emit("webrtc:peer-left", {
          peerId: socket.id,
        });

        if (room.players.size === 0) {
          clearChallengeTimer(room);
          rooms.delete(room.code);
        } else {
          if (room.hostId === socket.id) {
            room.hostId = Array.from(room.players.keys())[0];
          }

          if (room.currentTurnPlayerId === socket.id) {
            room.currentTurnPlayerId = Array.from(room.players.keys())[0];
          }

          addLog(room, `${socket.data.playerName ?? "A player"} disconnected.`);
          emitPrivateGameState(io, room);
        }
      }

      console.log(`Player disconnected: ${socket.id}`);
    });
  });

  return httpServer.listen(port, () => {
    console.log(`RAVO Online is running at http://${hostname}:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startServer();
}
