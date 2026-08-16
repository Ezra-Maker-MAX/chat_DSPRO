/**
 * Rummikub online server — boardgame.io (koa + socket.io).
 * Deploy on Railway (Node). Frontend connects via SocketIO.
 */
import { Server, Origins } from "boardgame.io/dist/cjs/server.js";
import { Rummikub } from "./Game.js";

// CORS: allow the chatmosphere app (Vercel preview + production) and localhost.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const origins = [Origins.LOCALHOST, ...ALLOWED_ORIGINS];

const server = Server({
  games: [Rummikub],
  origins,
  apiOrigins: origins,
  // In-memory storage is fine for casual play; swap to a DB-backed storage
  // (e.g. FlatFile) if you want matches to survive restarts.
});

const PORT = process.env.PORT || 9119;

server.run(PORT, () => {
  console.log(`[rummikub-server] listening on :${PORT}`);
  console.log(`[rummikub-server] origins:`, origins);
});
