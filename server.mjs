import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const challengeWindowMs = 5000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const rooms = new Map();

function createPlayableDeck() {
  const deck = [];

  for (let value = 1; value <= 10; value += 1) {
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

function isTruthfulPlay(card, announcedNumber) {
  if (card.type === "ravo-joker" || card.type === "bluff") {
    return true;
  }

  return card.value === announcedNumber;
}

function getPublicRoom(room) {
  const players = Array.from(room.players.values()).map((player) => ({
    ...player,
    cardCount: room.hands.get(player.id)?.length ?? 0,
  }));

  return {
    challengeEndsAt: room.challengeEndsAt,
    code: room.code,
    currentTurnPlayerId: room.currentTurnPlayerId,
    discardPileCount: room.discardPile.length,
    drawPileCount: room.drawPile.length,
    expectedNumber: room.expectedNumber,
    hostId: room.hostId,
    lastClaimedNumber: room.pendingPlay?.announcedNumber ?? room.lastClaimedNumber,
    lastAnnouncement: room.lastAnnouncement,
    lastPlayedCard: room.pendingPlay?.card ?? room.lastPlayedCard,
    lastPlayedBy: room.lastPlayedBy,
    lastRevealedAt: room.lastRevealedAt,
    lastRevealedCard: room.lastRevealedCard,
    lastRevealedCardLabel: room.lastRevealedCardLabel,
    lastRevealCallers: room.lastRevealCallers,
    lastRevealWasChallenged: room.lastRevealWasChallenged,
    log: room.log.slice(-8),
    pendingRavoCallers: Array.from(room.pendingRavoCallers),
    pendingPlayedCard: room.pendingPlay?.card ?? null,
    players,
    roundNumber: room.roundNumber,
    status: room.status,
    winnerId: room.winnerId,
  };
}

function getNextExpectedNumber(currentNumber) {
  return currentNumber === 10 ? 1 : currentNumber + 1;
}

function getNextPlayerId(room, fromPlayerId = room.currentTurnPlayerId) {
  const players = Array.from(room.players.values());
  const currentIndex = players.findIndex((player) => player.id === fromPlayerId);
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (safeCurrentIndex + 1) % players.length;

  return players[nextIndex].id;
}

function addLog(room, message) {
  room.log.push(message);
}

function drawCards(room, playerId, count) {
  const hand = room.hands.get(playerId) ?? [];
  let drawnCount = 0;

  for (let index = 0; index < count; index += 1) {
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

function clearChallengeTimer(room) {
  if (room.challengeTimer) {
    clearTimeout(room.challengeTimer);
    room.challengeTimer = null;
  }
}

function emitPrivateGameState(io, room) {
  for (const player of room.players.values()) {
    io.to(player.id).emit("game:state", {
      room: getPublicRoom(room),
      hand: room.hands.get(player.id) ?? [],
    });
  }
}

function finishPendingPlay(io, room) {
  if (!room.pendingPlay || room.status !== "challenge") {
    return;
  }

  clearChallengeTimer(room);

  const pendingPlay = room.pendingPlay;
  const callers = Array.from(room.pendingRavoCallers);
  const playedByName = room.players.get(pendingPlay.playerId)?.name ?? "A player";
  const isTruthful = isTruthfulPlay(pendingPlay.card, pendingPlay.announcedNumber);
  const isBluffCard = pendingPlay.card.type === "bluff";
  let nextTurnPlayerId = getNextPlayerId(room, pendingPlay.playerId);
  let advanceSequence = true;

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
  } else if (callers.length >= 2) {
    for (const callerId of callers) {
      const drawnCount = drawCards(room, callerId, 3);
      addLog(
        room,
        `${room.players.get(callerId)?.name ?? "A caller"} called RAVO at the same time and drew ${drawnCount} cards.`,
      );
    }
  } else {
    const callerId = callers[0];
    const callerName = room.players.get(callerId)?.name ?? "A caller";

    if (isBluffCard) {
      const drawnCount = drawCards(room, callerId, 3);
      nextTurnPlayerId = pendingPlay.playerId;
      advanceSequence = false;
      addLog(
        room,
        `${callerName} incorrectly called RAVO on a BLUFF card and drew ${drawnCount} cards. ${playedByName} gets another turn.`,
      );
    } else if (isTruthful) {
      const drawnCount = drawCards(room, callerId, 2);
      addLog(
        room,
        `${callerName} called RAVO incorrectly and drew ${drawnCount} cards.`,
      );
    } else {
      const drawnCount = drawCards(room, pendingPlay.playerId, 2);
      addLog(
        room,
        `${playedByName} was caught bluffing and drew ${drawnCount} cards.`,
      );
    }
  }

  const didPlayedPlayerWin = checkWinner(room, pendingPlay.playerId);

  if (!didPlayedPlayerWin) {
    room.status = "playing";
    room.currentTurnPlayerId = nextTurnPlayerId;
    addLog(room, `${room.players.get(nextTurnPlayerId)?.name ?? "Next player"}'s turn started.`);

    if (nextTurnPlayerId === Array.from(room.players.keys())[0]) {
      room.roundNumber += 1;
    }

    if (advanceSequence) {
      room.expectedNumber = getNextExpectedNumber(room.expectedNumber);
    }
  }

  room.pendingPlay = null;
  room.pendingRavoCallers.clear();
  room.challengeEndsAt = null;

  emitPrivateGameState(io, room);
}

function createRoom(socket, roomCode) {
  return {
    challengeEndsAt: null,
    challengeTimer: null,
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
    pendingRavoCallers: new Set(),
    players: new Map(),
    roundNumber: 1,
    hands: new Map(),
    status: "waiting",
    drawPile: [],
    discardPile: [],
    winnerId: null,
  };
}

app.prepare().then(() => {
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

      room.status = "playing";
      room.currentTurnPlayerId = Array.from(room.players.keys())[0];
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
      room.pendingRavoCallers.clear();
      room.roundNumber = 1;
      room.challengeEndsAt = null;
      room.winnerId = null;
      room.discardPile = [];
      room.drawPile = shuffleDeck(createPlayableDeck());
      clearChallengeTimer(room);

      for (const player of room.players.values()) {
        room.hands.set(player.id, room.drawPile.splice(0, 8));
      }

      addLog(room, "The game started. Each player received 8 cards.");
      callback({ ok: true, room: getPublicRoom(room) });
      emitPrivateGameState(io, room);
    });

    socket.on("game:play-card", ({ cardId }, callback) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room) {
        callback({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      if (room.status !== "playing") {
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

      const drawnCount = drawCards(room, socket.id, 1);

      if (drawnCount === 0) {
        callback({ ok: false, error: "The draw pile is empty." });
        return;
      }

      addLog(room, `${socket.data.playerName} drew 1 card instead of playing.`);
      console.log("draw card - reveal state unchanged");
      console.log("pendingPlayedCard", room.pendingPlay?.card ?? null);
      console.log("revealedCard", null);
      console.log("lastRevealedCard", room.lastRevealedCard);
      room.currentTurnPlayerId = getNextPlayerId(room, socket.id);
      if (room.currentTurnPlayerId === Array.from(room.players.keys())[0]) {
        room.roundNumber += 1;
      }
      room.expectedNumber = getNextExpectedNumber(room.expectedNumber);

      callback({ ok: true, room: getPublicRoom(room) });
      emitPrivateGameState(io, room);
    });

    socket.on("game:call-ravo", (callback) => {
      const room = rooms.get(socket.data.roomCode);

      if (!room) {
        callback({ ok: false, error: "Room not found. Create or join a room first." });
        return;
      }

      if (room.status !== "challenge" || !room.pendingPlay) {
        callback({ ok: false, error: "There is no card to challenge right now." });
        return;
      }

      if (room.pendingPlay.playerId === socket.id) {
        callback({ ok: false, error: "You cannot call RAVO on your own card." });
        return;
      }

      room.pendingRavoCallers.add(socket.id);
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

    socket.on("disconnect", () => {
      const room = rooms.get(socket.data.roomCode);

      if (room) {
        room.players.delete(socket.id);
        room.hands.delete(socket.id);
        room.pendingRavoCallers.delete(socket.id);

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

  httpServer.listen(port, () => {
    console.log(`RAVO Online is running at http://${hostname}:${port}`);
  });
});
