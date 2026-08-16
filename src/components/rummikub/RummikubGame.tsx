"use client";

import { useState } from "react";
import { Client } from "boardgame.io/react";
import { Local } from "boardgame.io/multiplayer";
import { Rummikub } from "@/lib/rummikub/Game";
import Board from "./Board";

/**
 * Local pass-and-play mode — 2 players on one device.
 * Used to validate rules + UI before wiring the online server.
 * (Switch to SocketIO multiplayer once the Railway server is up.)
 */
const LocalGame = Client({
  game: Rummikub,
  board: Board,
  multiplayer: Local(),
  numPlayers: 2,
  debug: false,
}) as unknown as React.ComponentType<{
  matchID?: string;
  playerID?: string;
  matchData?: { id: string; name: string }[];
}>;

interface RummikubGameProps {
  numPlayers?: number;
}

export default function RummikubGame({ numPlayers = 2 }: RummikubGameProps) {
  const [players, setPlayers] = useState<string[]>(Array.from({ length: numPlayers }, (_, i) => `玩家${i + 1}`));
  const [running, setRunning] = useState(false);
  const [activePlayer, setActivePlayer] = useState("0");

  // Lobby: name the players, then start.
  if (!running) {
    return (
      <div className="rmk-lobby">
        <div className="rmk-lobby-title">🎲 拉密 Rummikub</div>
        <div className="rmk-lobby-sub">
          经典数字麻将游戏：把手中的牌凑成顺子（同色连续数字）或刻子（同数字不同色），
          每组至少 3 张。首次出牌总分需 ≥30（破冰）。率先出完手牌者获胜。
        </div>
        <div className="rmk-lobby-form">
          {players.map((name, i) => (
            <div className="rmk-field" key={i}>
              <label>玩家 {i + 1} 的名字</label>
              <input
                className="rmk-input"
                value={name}
                maxLength={16}
                onChange={(e) => {
                  const next = [...players];
                  next[i] = e.target.value || `玩家${i + 1}`;
                  setPlayers(next);
                }}
              />
            </div>
          ))}
        </div>
        <button className="rmk-btn rmk-btn--primary" onClick={() => setRunning(true)}>
          ▶ 开始游戏
        </button>
      </div>
    );
  }

  return (
    <div className="rmk-table">
      {/* Pass-and-play player switcher */}
      <div className="rmk-players" style={{ justifyContent: "center" }}>
        {players.map((name, i) => (
          <button
            key={i}
            className={"rmk-player rmk-player--switch" + (activePlayer === String(i) ? " rmk-player--active" : "")}
            onClick={() => setActivePlayer(String(i))}
            style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}
          >
            <span className="rmk-player-name">
              {activePlayer === String(i) ? "👉 " : ""}
              {name}
            </span>
            <span className="rmk-player-count">P{i + 1}</span>
          </button>
        ))}
        <span className="rmk-pool">同屏轮流操作 — 轮到谁就点谁</span>
      </div>

      <LocalGame
        key={`${players.join("|")}-${activePlayer}`}
        matchID="local-demo"
        playerID={activePlayer}
        matchData={players.map((name, i) => ({ id: String(i), name }))}
      />
    </div>
  );
}
