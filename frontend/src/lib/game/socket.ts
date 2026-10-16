import { ApiRequestError } from "@/lib/api/client";

// Where the game sockets go. Set when the web app's host can't pass WebSockets on to the backend
// (Vercel): the browser then connects to the backend itself, e.g. wss://aary-api.herokuapp.com.
// Without it: this origin, where Next rewrites /api/* to the backend, WebSockets included.
const SOCKET_BASE = process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, "");

function socketUrl(path: string): string {
  if (SOCKET_BASE) return `${SOCKET_BASE}${path}`;
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/api${path}`;
}

/** A refused ticket request ends the connection like the socket would have: 4401 or 4403. */
function finalCodeFor(error: unknown): number | null {
  if (!(error instanceof ApiRequestError)) return null;
  if (error.status === 401) return 4401;
  if (error.status === 403 || error.status === 404) return 4403;
  return null;
}

// The server closes with these when retrying can't help: not logged in, not allowed (kicked, or the
// game is gone), a bad first message, too many connections, a message that was too big.
const FINAL_CODES: ReadonlySet<number> = new Set([1009, 4400, 4401, 4403, 4429]);
// Events after which the server closes the connection on purpose.
const ENDING_EVENTS: ReadonlySet<string> = new Set(["kicked", "replaced", "game.closed"]);

const MAX_RETRIES = 6;
const RETRY_BASE_MS = 500;

type Message = Record<string, unknown> & { type: string };

export type GameSocket = {
  send: (message: Message) => void;
  close: () => void;
};

type Options<E extends { type: string }> = {
  /** `/ws/play` or `/ws/host/<game id>`. */
  path: string;
  /**
   * The first message after every connect. A player's token, or for the host a function that asks
   * for a fresh one-minute ticket before each connect (the session cookie may not reach the backend).
   */
  token: string | (() => Promise<string>);
  onEvent: (event: E) => void;
  /** The connection is over for good: no more retries. `code` is the WebSocket close code. */
  onClosed: (code: number) => void;
};

/**
 * One game connection. It answers the server's pings (that is how the server measures the delay and
 * compensates answer times), and if the connection drops it reconnects and says hello again: the
 * server then sends a snapshot, so the screen picks up where the game is now.
 */
export function openGameSocket<E extends { type: string }>(options: Options<E>): GameSocket {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const raw = (message: Message) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ v: 1, ...message }));
  };

  function finish(code: number) {
    if (stopped) return;
    stopped = true;
    options.onClosed(code);
  }

  function retryLater() {
    timer = setTimeout(() => void connect(), RETRY_BASE_MS * 2 ** retries);
    retries += 1;
  }

  async function connect() {
    let token: string;
    try {
      token = typeof options.token === "string" ? options.token : await options.token();
    } catch (error) {
      if (stopped) return;
      const code = finalCodeFor(error);
      if (code !== null || retries >= MAX_RETRIES) return finish(code ?? 1006);
      return retryLater();
    }
    if (stopped) return;
    const ws = new WebSocket(socketUrl(options.path));
    socket = ws;
    ws.onopen = () => raw({ type: "hello", token });
    ws.onmessage = (message: MessageEvent<string>) => {
      let event: E & { n?: unknown };
      try {
        event = JSON.parse(message.data) as E & { n?: unknown };
      } catch {
        return;
      }
      retries = 0; // the server answered: the connection is good
      if (event.type === "ping") {
        if (typeof event.n === "number") raw({ type: "pong", n: event.n });
        return;
      }
      options.onEvent(event);
      if (ENDING_EVENTS.has(event.type)) finish(1000);
    };
    ws.onclose = (closeEvent) => {
      if (stopped || socket !== ws) return;
      if (FINAL_CODES.has(closeEvent.code) || retries >= MAX_RETRIES) return finish(closeEvent.code);
      retryLater();
    };
  }

  void connect();
  return {
    send: raw,
    close() {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    },
  };
}
