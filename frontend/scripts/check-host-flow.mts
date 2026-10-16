// Checks how the host's screen state follows what the server sends (docs/protocol.md).
// Run: pnpm check:host
import { hostReducer, initialHostState, type HostFlowEvent, type HostState } from "../src/lib/hostFlow/reducer.ts";
import type { HostEvent, HostQuestion, ServerStanding } from "../src/lib/game/events.ts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
};

const run = (events: HostFlowEvent[], from: HostState = initialHostState) => events.reduce(hostReducer, from);
const server = (event: HostEvent): HostFlowEvent => ({ type: "SERVER", event });
const character = { shape: "star", color: "teal", face: "shy" } as const;
const player = (id: string) => ({ id, nickname: id.toUpperCase(), character });
const row = (id: string, rank: number, score: number): ServerStanding => ({ ...player(id), score, rank });
const question: HostQuestion = { index: 1, total: 3, text: "Q?", seconds: 20, answers: ["a", "b", "c", "d"] };

const lobby = run([
  { type: "CREATED", gameId: "g1", pin: "123456", totalQuestions: 3 },
  server({ type: "lobby.updated", players: [player("a"), player("b")] }),
]);
check("creating the lobby gives the PIN and the question count", lobby.pin === "123456" && lobby.totalQuestions === 3 && lobby.phase === "lobby");
check("players joining show up in the lobby", lobby.players.map((p) => p.nickname).join() === "A,B");

const playing = run([server({ type: "question.started", question })], lobby);
check("a question starts: phase, round, full clock, no answers yet, correct unknown", playing.phase === "question" && playing.round === 1 && playing.secondsLeft === 20 && playing.answered === 0 && playing.correct === null);
check("the host screen gets the four answer texts", playing.question?.answers.join("") === "abcd");
check("answer counts arrive while the question is open", run([server({ type: "answer.count", answered: 2, total: 2 })], playing).answered === 2);
check("a late answer count after the question closed is ignored", run([server({ type: "question.closed", counts: [1, 0, 1, 0], correct: 1 }), server({ type: "answer.count", answered: 9, total: 9 })], playing).answered === 0);
check("the clock only draws: ticks stop at zero and don't close the question", run(Array(25).fill({ type: "TICK" }), playing).secondsLeft === 0 && run(Array(25).fill({ type: "TICK" }), playing).phase === "question");

const suspect = { playerId: "a", nickname: "a", flags: [{ kind: "TAB_BLUR", count: 1 }] };
const flagged = run([server({ type: "question.closed", counts: [1, 0, 1, 0], correct: 1 }), server({ type: "cheaters", cheaters: [suspect] })], playing);
check("the suspects after a question are kept until the host rules", flagged.cheaters.length === 1 && run([server({ type: "cheaters", cheaters: [] })], flagged).cheaters.length === 0);
check("a new question starts without suspects", run([server({ type: "question.started", question })], flagged).cheaters.length === 0);
const counted = run([server({ type: "question.closed", counts: [1, 0, 1, 0], correct: 1 })], playing);
check("closing shows counts per answer and the right one", counted.phase === "counts" && counted.counts?.join() === "1,0,1,0" && counted.correct === 1);
check("short counts are padded to four", run([server({ type: "question.closed", counts: [3], correct: 2 })], playing).counts?.join() === "3,0,0,0");

const board = run([server({ type: "leaderboard", standings: [row("a", 1, 900), row("b", 2, 800)] })], counted);
check("the leaderboard has ranks and nobody is «you» on the host screen", board.phase === "leaderboard" && board.standings.length === 2 && board.standings.every((s) => !s.isYou));
const ended = run([server({ type: "game.ended", gameId: "g1", standings: [row("a", 1, 900)] })], board);
check("the end shows the podium and knows which game to report", ended.phase === "podium" && ended.gameId === "g1");

const snap = (over: Partial<Extract<HostEvent, { type: "host.state" }>>): HostFlowEvent =>
  server({ type: "host.state", gameId: "g1", pin: "123456", phase: "lobby", total: 3, players: [], question: null, remainingMs: null, answered: 0, counts: null, correct: null, standings: null, cheaters: null, ...over });
const fresh = (over: Partial<Extract<HostEvent, { type: "host.state" }>>) => run([snap(over)]);
check("snapshot in the lobby", fresh({}).phase === "lobby" && fresh({}).round === 0);
check("snapshot mid-question restores the clock, the answer count and the question", fresh({ phase: "question", question, remainingMs: 7400, answered: 2, players: [player("a"), player("b")] }).secondsLeft === 8 && fresh({ phase: "question", question, remainingMs: 7400, answered: 2 }).answered === 2 && fresh({ phase: "question", question, remainingMs: 7400 }).round === 1);
check("snapshot on the counts screen restores counts and the right answer", fresh({ phase: "counts", question, counts: [0, 2, 0, 0], correct: 2 }).counts?.join() === "0,2,0,0" && fresh({ phase: "counts", question, counts: [0, 2, 0, 0], correct: 2 }).correct === 2);
check("the podium keeps the suspected cheaters the server lists", fresh({ phase: "ended", standings: [row("a", 1, 5)], cheaters: [{ playerId: "a", nickname: "a", flags: [{ kind: "FAST_ANSWERS", count: 2 }] }] }).cheaters.length === 1 && fresh({ phase: "ended", standings: [row("a", 1, 5)] }).cheaters.length === 0);
check("snapshot on the leaderboard and at the end", fresh({ phase: "leaderboard", standings: [row("a", 1, 5)] }).phase === "leaderboard" && fresh({ phase: "ended", standings: [row("a", 1, 5)] }).phase === "podium");
check("a second host screen replacing this one ends this one", run([server({ type: "replaced" })], playing).replaced === true);
check("refused commands change nothing on screen", run([server({ type: "error", code: "NO_PLAYERS" })], lobby) === lobby);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
