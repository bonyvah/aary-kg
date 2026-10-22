/** The seconds a question screen counts down: first its reading time, then the time to answer. */
export type QuestionClock = { readingLeft: number; secondsLeft: number };

/** From what the server sent: `remainingMs` until the question closes (reading included), `readingMs` until it opens. */
export function questionClock(seconds: number, remainingMs: number | null, readingMs: number | null | undefined): QuestionClock {
  const reading = readingMs ?? 0;
  return {
    readingLeft: Math.ceil(reading / 1000),
    secondsLeft: remainingMs === null ? seconds : Math.ceil(Math.max(0, remainingMs - reading) / 1000),
  };
}

/** One second later. Only draws the clock: the server opens and closes the question. */
export function tickClock({ readingLeft, secondsLeft }: QuestionClock): QuestionClock {
  return readingLeft > 0 ? { readingLeft: readingLeft - 1, secondsLeft } : { readingLeft, secondsLeft: Math.max(0, secondsLeft - 1) };
}
