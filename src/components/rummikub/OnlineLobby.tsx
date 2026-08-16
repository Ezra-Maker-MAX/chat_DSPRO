"use client";

import { useState } from "react";
import { LobbyClient } from "boardgame.io/client";
import { GAME_NAME } from "@/lib/rummikub/constants";

/**
 * Connects to the boardgame.io server for online play.
 * Server URL: NEXT_PUBLIC_RUMMIKUB_SERVER (production) or http://localhost:9119 (dev).
 */
export function getServerUrl(): string {
  const env = process.env.NEXT_PUBLIC_RUMMIKUB_SERVER;
  if (env) return env;
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:9119";
  }
  // Fallback: same host as the frontend (won't work unless reverse-proxied).
  return window.location.origin;
}

export function makeLobbyClient(): LobbyClient {
  return new LobbyClient({ server: getServerUrl() });
}

interface OnlineLobbyProps {
  onEnterMatch: (matchID: string, playerID: string, creds: string, players: string[]) => void;
  defaultName: string;
}

/** Create / join a match against the boardgame.io server. */
export default function OnlineLobby({ onEnterMatch, defaultName }: OnlineLobbyProps) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState(defaultName);
  const [numPlayers, setNumPlayers] = useState(2);
  const [matchID, setMatchID] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = makeLobbyClient();

  async function onCreate() {
    setBusy(true);
    setError("");
    try {
      const created = await client.createMatch(GAME_NAME, {
        numPlayers,
        setupData: { timePerTurn: 30 },
      });
      const id = created.matchID;
      const creds = (await client.joinMatch(GAME_NAME, id, { playerID: "0", playerName: name || "玩家1" })).playerCredentials;
      const match = await client.getMatch(GAME_NAME, id);
      onEnterMatch(id, "0", creds, (match.players || []).map((p: any) => p?.name || `玩家${+p.id + 1}`));
    } catch (e: any) {
      setError(e?.message || "创建失败，请确认联机服务已启动");
    }
    setBusy(false);
  }

  async function onJoin() {
    if (!matchID.trim()) {
      setError("请输入房间号");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const match = await client.getMatch(GAME_NAME, matchID.trim());
      const freeSeat = (match.players || []).find((p: any) => !p?.name);
      if (!freeSeat) {
        setError("房间已满");
        setBusy(false);
        return;
      }
      const seat = String(freeSeat.id);
      const creds = (await client.joinMatch(GAME_NAME, matchID.trim(), {
        playerID: seat,
        playerName: name || `玩家${+seat + 1}`,
      })).playerCredentials;
      const updated = await client.getMatch(GAME_NAME, matchID.trim());
      onEnterMatch(matchID.trim(), seat, creds, (updated.players || []).map((p: any) => p?.name || `玩家${+p.id + 1}`));
    } catch (e: any) {
      setError(e?.message || "加入失败，请检查房间号");
    }
    setBusy(false);
  }

  return (
    <div className="rmk-lobby">
      <div className="rmk-lobby-title">🎲 拉密 · 联机</div>
      <div className="rmk-lobby-tabs">
        <button className={"rmk-tab" + (mode === "create" ? " rmk-tab--active" : "")} onClick={() => { setMode("create"); setError(""); }}>
          创建房间
        </button>
        <button className={"rmk-tab" + (mode === "join" ? " rmk-tab--active" : "")} onClick={() => { setMode("join"); setError(""); }}>
          加入房间
        </button>
      </div>

      <div className="rmk-lobby-form">
        <div className="rmk-field">
          <label>你的名字</label>
          <input className="rmk-input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
        </div>

        {mode === "create" ? (
          <div className="rmk-field">
            <label>玩家人数</label>
            <select
              className="rmk-input"
              value={numPlayers}
              onChange={(e) => setNumPlayers(parseInt(e.target.value))}
            >
              <option value={2}>2 人</option>
              <option value={3}>3 人</option>
              <option value={4}>4 人</option>
            </select>
          </div>
        ) : (
          <div className="rmk-field">
            <label>房间号（Match ID）</label>
            <input className="rmk-input" value={matchID} placeholder="例如 a1b2c3" onChange={(e) => setMatchID(e.target.value)} />
          </div>
        )}

        {error && <div className="rmk-lobby-error">{error}</div>}

        {mode === "create" ? (
          <button className="rmk-btn rmk-btn--primary" disabled={busy} onClick={onCreate}>
            {busy ? "创建中…" : "创建房间"}
          </button>
        ) : (
          <button className="rmk-btn rmk-btn--primary" disabled={busy} onClick={onJoin}>
            {busy ? "加入中…" : "加入房间"}
          </button>
        )}
      </div>

      <div className="rmk-lobby-note">创建后把房间号发给朋友，他们选「加入房间」输入即可。</div>
    </div>
  );
}
