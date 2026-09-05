import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlayableDeck,
  createRoom,
  drawTurnCard,
  emitPrivateGameState,
  finishPendingPlay,
  finishBluffExtra,
  getNextExpectedNumber,
  getPublicRoom,
  isTruthfulPlay,
  playBluffExtraCard,
  registerRavoCall,
  resetGameRound,
} from "../server.mjs";

function makeIo() {
  const events = [];
  return {
    events,
    to(target) {
      return { emit: (name, payload) => events.push({ name, payload, target }) };
    },
  };
}

function makeRoom(playerCount = 2) {
  const room = createRoom({ id: "p1" }, "TEST01");
  for (let index = 1; index <= playerCount; index += 1) {
    room.players.set(`p${index}`, { id: `p${index}`, name: `Player ${index}` });
    room.mediaStatus.set(`p${index}`, { cameraOn: false, micOn: false });
    room.hands.set(`p${index}`, [{ id: `held-${index}`, type: "number", value: 9 }]);
  }
  room.drawPile = Array.from({ length: 20 }, (_, index) => ({ id: `draw-${index}`, type: "number", value: 1 }));
  room.status = "challenge";
  room.currentTurnPlayerId = "p1";
  room.startingPlayerId = "p1";
  room.expectedNumber = 1;
  room.lastPlayedBy = "p1";
  return room;
}

function resolve(card, { callers = [], hand = [{ id: "held", type: "number", value: 9 }], number = 1, players = 2 } = {}) {
  const room = makeRoom(players);
  room.expectedNumber = number;
  room.hands.set("p1", hand);
  room.pendingPlay = { announcedNumber: number, card, playerId: "p1" };
  room.pendingRavoCallers = new Set(callers);
  room.lastPlayedCard = card;
  const io = makeIo();
  finishPendingPlay(io, room);
  return { io, room };
}

test("deck has the required 90-card distribution", () => {
  const deck = createPlayableDeck();
  assert.equal(deck.length, 90);
  for (let value = 1; value <= 9; value += 1) {
    assert.equal(deck.filter((card) => card.type === "number" && card.value === value).length, 9);
  }
  assert.equal(deck.filter((card) => card.type === "ravo-joker").length, 6);
  assert.equal(deck.filter((card) => card.type === "bluff").length, 3);
});

test("truth rules distinguish number bluffs while Joker stays honest", () => {
  assert.equal(isTruthfulPlay({ type: "number", value: 1 }, 1), true);
  assert.equal(isTruthfulPlay({ type: "number", value: 2 }, 1), false);
  assert.equal(isTruthfulPlay({ type: "ravo-joker" }, 7), true);
});

test("honest and dishonest numbers without RAVO have no penalty", () => {
  for (const value of [1, 2]) {
    const { room } = resolve({ id: `n${value}`, type: "number", value });
    assert.equal(room.hands.get("p1").length, 1);
    assert.equal(room.hands.get("p2").length, 1);
    assert.equal(room.expectedNumber, 2);
  }
});

test("RAVO penalizes the caller for an honest number and the player for a false number", () => {
  const honest = resolve({ id: "n1", type: "number", value: 1 }, { callers: ["p2"] }).room;
  assert.equal(honest.hands.get("p2").length, 3);
  const falsePlay = resolve({ id: "n2", type: "number", value: 2 }, { callers: ["p2"] }).room;
  assert.equal(falsePlay.hands.get("p1").length, 3);
  assert.equal(falsePlay.expectedNumber, 2);
});

test("Joker wins as an honest last card with or without RAVO", () => {
  for (const callers of [[], ["p2"]]) {
    const { room } = resolve({ id: "j", type: "ravo-joker" }, { callers, hand: [] });
    assert.equal(room.winnerId, "p1");
    if (callers.length) assert.equal(room.hands.get("p2").length, 3);
  }
});

test("a caught false last number draws two and does not win", () => {
  const { room } = resolve({ id: "n2", type: "number", value: 2 }, { callers: ["p2"], hand: [] });
  assert.equal(room.winnerId, null);
  assert.equal(room.hands.get("p1").length, 2);
});

test("BLUFF without a call ends normally and can be the winning last card", () => {
  const { room } = resolve({ id: "b", type: "bluff" }, { hand: [] });
  assert.equal(room.winnerId, "p1");
  assert.equal(room.expectedNumber, 1);
});

test("challenged BLUFF gives two unchallengeable extras and no caller penalty", () => {
  const { room } = resolve({ id: "b", type: "bluff" }, { callers: ["p2"], hand: [
    { id: "x", type: "number", value: 8 },
    { id: "y", type: "ravo-joker" },
  ] });
  assert.equal(room.status, "bluff-extra");
  assert.equal(room.bluffExtraRemaining, 2);
  assert.equal(room.hands.get("p2").length, 1);
  assert.equal(playBluffExtraCard(room, "p1", "x").ok, true);
  assert.equal(playBluffExtraCard(room, "p1", "y").didWin, true);
  assert.equal(room.winnerId, "p1");
});

test("one remaining BLUFF bonus card wins immediately without a second card", () => {
  const { room } = resolve({ id: "b", type: "bluff" }, { callers: ["p2"], hand: [{ id: "last", type: "number", value: 4 }] });
  const result = playBluffExtraCard(room, "p1", "last");
  assert.equal(result.didWin, true);
  assert.equal(room.winnerId, "p1");
});

test("BLUFF bonus may be ended after zero or one extra card", () => {
  for (const cardsPlayed of [0, 1]) {
    const room = resolve({ id: "b", type: "bluff" }, { callers: ["p2"], hand: [
      { id: "x", type: "number", value: 4 }, { id: "y", type: "number", value: 5 },
    ] }).room;
    if (cardsPlayed === 1) playBluffExtraCard(room, "p1", "x");
    assert.equal(finishBluffExtra(room, "p1").ok, true);
    assert.equal(room.status, "playing");
    assert.equal(room.expectedNumber, 2);
  }
});

test("number sequence wraps and advances once after a resolved play and all bonus cards", () => {
  assert.equal(getNextExpectedNumber(9), 1);
  const normal = resolve({ id: "n9", type: "number", value: 9 }, { number: 9 }).room;
  assert.equal(normal.expectedNumber, 1);
  const bonus = resolve({ id: "b", type: "bluff" }, { callers: ["p2"], number: 9, hand: [
    { id: "x", type: "number", value: 1 }, { id: "y", type: "number", value: 2 }, { id: "z", type: "number", value: 3 },
  ] }).room;
  playBluffExtraCard(bonus, "p1", "x");
  playBluffExtraCard(bonus, "p1", "y");
  assert.equal(bonus.expectedNumber, 1);
});

test("a play can be resolved only once", () => {
  const room = makeRoom();
  room.pendingPlay = { announcedNumber: 1, card: { id: "n1", type: "number", value: 1 }, playerId: "p1" };
  room.pendingRavoCallers.add("p2");
  const io = makeIo();
  finishPendingPlay(io, room);
  const countAfterFirst = room.hands.get("p2").length;
  finishPendingPlay(io, room);
  assert.equal(room.hands.get("p2").length, countAfterFirst);
});

test("drawing advances 9 to 1 exactly once and a duplicate draw is rejected", () => {
  const room = makeRoom();
  room.status = "playing";
  room.expectedNumber = 9;
  assert.equal(drawTurnCard(room, "p1").ok, true);
  assert.equal(room.expectedNumber, 1);
  assert.equal(drawTurnCard(room, "p1").ok, false);
  assert.equal(room.expectedNumber, 1);
});

test("the first concurrent RAVO caller wins and duplicate or later callers are rejected", () => {
  const room = makeRoom(3);
  room.pendingPlay = { announcedNumber: 1, card: { id: "secret", type: "number", value: 1 }, playerId: "p1" };
  room.challengeEndsAt = 10_000;
  assert.equal(registerRavoCall(room, "p2", 9_000).ok, true);
  assert.equal(registerRavoCall(room, "p2", 9_000).ok, false);
  assert.equal(registerRavoCall(room, "p3", 9_000).ok, false);
  assert.deepEqual([...room.pendingRavoCallers], ["p2"]);
});

test("late RAVO calls and duplicate bonus-card actions are rejected", () => {
  const room = makeRoom();
  room.pendingPlay = { announcedNumber: 1, card: { id: "secret", type: "number", value: 1 }, playerId: "p1" };
  room.challengeEndsAt = 10_000;
  assert.equal(registerRavoCall(room, "p2", 10_001).ok, false);
  const bonus = resolve({ id: "b", type: "bluff" }, { callers: ["p2"], hand: [{ id: "x", type: "number", value: 4 }, { id: "y", type: "number", value: 5 }] }).room;
  assert.equal(playBluffExtraCard(bonus, "p1", "x").ok, true);
  assert.equal(playBluffExtraCard(bonus, "p1", "x").ok, false);
});

test("public challenge data contains no hidden card type, value, or id", () => {
  const room = makeRoom();
  room.pendingPlay = { announcedNumber: 1, card: { id: "secret-id", type: "number", value: 7 }, playerId: "p1" };
  room.lastPlayedCard = room.pendingPlay.card;
  const serialized = JSON.stringify(getPublicRoom(room));
  assert.equal(getPublicRoom(room).pendingPlayedCard, true);
  assert.equal(getPublicRoom(room).lastPlayedCard, null);
  assert.doesNotMatch(serialized, /secret-id|\"value\":7|\"type\":\"number\"/);

  const io = makeIo();
  emitPrivateGameState(io, room);
  const opponentTransmission = io.events.find((event) => event.target === "p2" && event.name === "game:state");
  const transmittedRoom = JSON.stringify(opponentTransmission.payload.room);
  assert.doesNotMatch(transmittedRoom, /secret-id|\"value\":7|\"type\":\"number\"/);
  assert.equal(opponentTransmission.payload.room.pendingPlayedCard, true);
});

test("an incomplete two-card penalty is not partially paid and cannot create a winner", () => {
  const room = makeRoom();
  room.drawPile = [{ id: "only", type: "number", value: 1 }];
  room.hands.set("p1", []);
  room.pendingPlay = { announcedNumber: 1, card: { id: "false", type: "number", value: 2 }, playerId: "p1" };
  room.pendingRavoCallers.add("p2");
  finishPendingPlay(makeIo(), room);
  assert.equal(room.status, "draw-pile-empty");
  assert.equal(room.winnerId, null);
  assert.equal(room.hands.get("p1").length, 0);
  assert.equal(room.drawPile.length, 1);
  assert.deepEqual(room.pendingPenalty, { count: 2, playerId: "p1" });
});

test("round setup supports both 2 and 8 players with eight cards each", () => {
  for (const count of [2, 8]) {
    const room = makeRoom(count);
    resetGameRound(room, () => 0);
    assert.equal(room.players.size, count);
    for (const id of room.players.keys()) assert.equal(room.hands.get(id).length, 8);
    assert.equal(room.drawPile.length, 90 - count * 8);
  }
});

test("controlled random selection can choose every edge seat for 2 and 8 players", () => {
  for (const count of [2, 8]) {
    const room = makeRoom(count);
    resetGameRound(room, () => 0);
    assert.equal(room.startingPlayerId, "p1");
    assert.equal(room.currentTurnPlayerId, "p1");
    assert.equal(room.expectedNumber, 1);

    resetGameRound(room, () => 0.999999);
    assert.equal(room.startingPlayerId, `p${count}`);
    assert.equal(room.currentTurnPlayerId, `p${count}`);
    assert.equal(room.expectedNumber, 1);
  }
});

test("Play Again setup performs a fresh controlled start selection", () => {
  const room = makeRoom(8);
  resetGameRound(room, () => 0);
  assert.equal(room.startingPlayerId, "p1");
  resetGameRound(room, () => 0.5);
  assert.equal(room.startingPlayerId, "p5");
});

test("round counter completes when play returns to the selected starter", () => {
  const room = makeRoom(4);
  room.status = "playing";
  room.startingPlayerId = "p3";
  room.currentTurnPlayerId = "p3";
  room.roundNumber = 1;
  for (const playerId of ["p3", "p4", "p1"]) {
    assert.equal(drawTurnCard(room, playerId).ok, true);
    assert.equal(room.roundNumber, 1);
  }
  assert.equal(drawTurnCard(room, "p2").ok, true);
  assert.equal(room.currentTurnPlayerId, "p3");
  assert.equal(room.roundNumber, 2);
});

test("empty draw pile reshuffles all but the top discard card", () => {
  const room = makeRoom();
  room.status = "playing";
  room.drawPile = [];
  room.discardPile = [1, 2, 3].map((value) => ({
    announcedNumber: value,
    card: { id: `discard-${value}`, type: "number", value },
    playerId: "p1",
  }));
  assert.equal(drawTurnCard(room, "p1").ok, true);
  assert.equal(room.discardPile.length, 1);
  assert.equal(room.discardPile[0].card.id, "discard-3");
  assert.equal(room.drawPile.length, 1);
});

test("penalties use reshuffled cards and are paid in full", () => {
  const room = makeRoom();
  room.drawPile = [];
  room.discardPile = [1, 2, 3, 4].map((value) => ({
    announcedNumber: value,
    card: { id: `discard-${value}`, type: "number", value },
    playerId: "p1",
  }));
  room.pendingPlay = { announcedNumber: 4, card: room.discardPile.at(-1).card, playerId: "p1" };
  room.pendingRavoCallers.add("p2");
  finishPendingPlay(makeIo(), room);
  assert.equal(room.hands.get("p2").length, 3);
  assert.equal(room.discardPile.length, 1);
  assert.equal(room.discardPile[0].card.id, "discard-4");
  assert.equal(room.pendingPenalty, null);
});
