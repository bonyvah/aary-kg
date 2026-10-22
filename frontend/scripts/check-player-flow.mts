// Checks how the player's screen state follows what the server sends (docs/protocol.md).
// Run: pnpm check:player
import { flowReducer, initialState, toStandings, type FlowEvent, type FlowState } from "../src/lib/playerFlow/reducer.ts";
import type { PlayerEvent, ServerStanding } from "../src/lib/game/events.ts";
import type { AnswerPosition } from "../src/components/game/AnswerTile.tsx";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};

const run = (events: FlowEvent[], from: FlowState = initialState) => events.reduce(flowReducer, from);
const server = (event: PlayerEvent): FlowEvent => ({ type: "SERVER", event });
const character = { shape: "star", color: "teal", face: "shy" } as const;
const row = (id: string, rank: number, score: number): ServerStanding => ({ id, nickname: id.toUpperCase(), character, score, rank });
const question = { index: 1, total: 3, text: "Q?", seconds: 20, positions: [1, 2, 3, 4] as AnswerPosition[] };
const you = row("me", 2, 700);

const joined = run([
  { type: "PIN_ACCEPTED", pin: "123456" },
  { type: "JOINED", playerId: "me", nickname: "ME", character },
]);
check("PIN, then joining, lands in the lobby with the server's character", joined.phase === "lobby" && joined.character.shape === "star" && joined.playerId === "me");

const playing = run([server({ type: "question.started", question })], joined);
check("a question starts with the full time on the clock", playing.phase === "question" && playing.secondsLeft === 20 && playing.selected === null);
check("the clock only draws: ticks count down to zero and stop", run(Array(25).fill({ type: "TICK" }), playing).secondsLeft === 0 && run(Array(25).fill({ type: "TICK" }), playing).phase === "question");

const readingStart = run([server({ type: "question.started", question, readingMs: 3000 })], joined);
check("a question is read first: the answer clock waits", readingStart.readingLeft === 3 && readingStart.secondsLeft === 20);
const afterReading = run(Array(4).fill({ type: "TICK" }), readingStart);
check("after the reading time the answer clock runs", afterReading.readingLeft === 0 && afterReading.secondsLeft === 19);
const resumedReading = run([server({ type: "state", phase: "question", you: { id: "me", nickname: "ME", character, score: 0, rank: 1 }, players: [], question, remainingMs: 21_500, readingMs: 1_500, answered: null, reveal: null, top: null })], joined);
check("a reconnect while reading splits the time: reading, then answering", resumedReading.readingLeft === 2 && resumedReading.secondsLeft === 20);

const answered = run([{ type: "ANSWER_SELECTED", position: 2 }, { type: "ANSWER_SELECTED", position: 4 }], playing);
check("one tap locks the answer, a second tap changes nothing", answered.phase === "answered" && answered.selected === 2);
check("taps in the lobby or on the results screen do nothing", run([{ type: "ANSWER_SELECTED", position: 1 }], joined).phase === "lobby");

const closed = run([server({ type: "question.closed", reveal: { correct: 2, points: 900 }, score: 900, rank: 1 })], answered);
check("the reveal shows the points and takes the server's total score", closed.phase === "result" && closed.reveal?.points === 900 && closed.score === 900);
check("a late question.closed after the result changes nothing", run([server({ type: "question.closed", reveal: { correct: 1, points: 5 }, score: 5, rank: 1 })], closed).score === 900);
check("timing out gives a result with no tap", run([server({ type: "question.closed", reveal: { correct: 2, points: 0 }, score: 0, rank: 3 })], playing).selected === null);

const top = [row("a", 1, 900), row("b", 2, 800), row("c", 3, 750)];
const board = run([server({ type: "leaderboard", top, you: row("z", 9, 100) })], closed);
check("the leaderboard adds the player's own row when they are outside the top", board.standings.length === 4 && board.standings[3]?.isYou === true && board.standings[3]?.id === "z");
check("inside the top, only that row is marked", toStandings(top, row("b", 2, 800)).filter((r) => r.isYou).map((r) => r.id).join() === "b");
check("the game ending shows the podium", run([server({ type: "game.ended", top, you })], board).phase === "podium");

// Reconnecting: the snapshot rebuilds the screen from the server's picture.
const snap = (over: Partial<Extract<PlayerEvent, { type: "state" }>>): FlowEvent =>
  server({ type: "state", phase: "lobby", you, players: [], question: null, remainingMs: null, answered: null, reveal: null, top: null, ...over });
const fresh = (over: Partial<Extract<PlayerEvent, { type: "state" }>>) => run([snap(over)]);
check("snapshot in the lobby", fresh({}).phase === "lobby" && fresh({}).nickname === "ME" && fresh({}).playerId === "me");
check("snapshot mid-question, not answered yet: time left rounds up", fresh({ phase: "question", question, remainingMs: 12_300 }).secondsLeft === 13 && fresh({ phase: "question", question, remainingMs: 12_300 }).phase === "question");
check("snapshot mid-question after answering shows the answered screen with the tap", fresh({ phase: "question", question, remainingMs: 5000, answered: 3 }).phase === "answered" && fresh({ phase: "question", question, remainingMs: 5000, answered: 3 }).selected === 3);
check("snapshot on the results screen keeps the reveal and what was tapped", fresh({ phase: "counts", question, reveal: { correct: 2, points: 0 }, answered: 1 }).selected === 1 && fresh({ phase: "counts", question, reveal: { correct: 2, points: 0 }, answered: 1 }).phase === "result");
check("snapshot on the leaderboard and the podium carry the rows", fresh({ phase: "leaderboard", question, top }).standings.length === 4 && fresh({ phase: "ended", top }).phase === "podium");
check("a reconnect in the lobby keeps the character builder open", run([{ type: "CHARACTER_OPENED" }, snap({})], joined).phase === "character");
check("a question that is already over has zero seconds", fresh({ phase: "question", question, remainingMs: 0 }).secondsLeft === 0);

// Leaving
check("kicked, closed or disconnected: back to the start with the reason", run([{ type: "LEFT", reason: "KICKED" }], closed).phase === "join" && run([{ type: "LEFT", reason: "KICKED" }], closed).error === "KICKED");
check("the character can be changed in the lobby only", run([{ type: "CHARACTER_CHANGED", character: { shape: "pill", color: "red", face: "wink" } }], playing).character.shape === "star" && run([{ type: "CHARACTER_CHANGED", character: { shape: "pill", color: "red", face: "wink" } }], joined).character.shape === "pill");
check("errors stay until the next try succeeds", run([{ type: "REJECTED", error: "PIN_INVALID" }]).error === "PIN_INVALID" && run([{ type: "REJECTED", error: "PIN_INVALID" }, { type: "PIN_ACCEPTED", pin: "123456" }]).error === null);
check("server noise that needs no screen change leaves the state alone", run([server({ type: "lobby.updated", players: [] }), server({ type: "answer.accepted", position: 1 }), server({ type: "error", code: "ANSWER_CLOSED" })], playing) === playing);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
