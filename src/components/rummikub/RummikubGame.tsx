"use client";

import { useState } from "react";
import { Client } from "boardgame.io/react";
import { Local, SocketIO } from "boardgame.io/multiplayer";
import { Rummikub } from "@/lib/rummikub/Game";
import Board from "./Board";
import OnlineLobby, { getServerUrl } from "./OnlineLobby";

/* ---------- Local pass-and-play ---------- */
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

/* ---------- Online (SocketIO) ---------- */
const OnlineGame = Client({
  game: Rummikub,
  board: Board,
  multiplayer: SocketIO({ server: getServerUrl() }),
  numPlayers: 2,
  debug: false,
}) as unknown as React.ComponentType<{
  matchID?: string;
  playerID?: string;
  credentials?: string;
  matchData?: { id: string; name: string }[];
}>;

type Screen = "menu" | "localLobby" | "localMatch" | "onlineLobby" | "onlineMatch";

interface OnlineCtx {
  matchID: string;
  playerID: string;
  creds: string;
  players: string[];
}

export default function RummikubGame() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [localPlayers, setLocalPlayers] = useState<string[]>(["玩家1", "玩家2"]);
  const [activeLocal, setActiveLocal] = useState("0");
  const [online, setOnline] = useState<OnlineCtx | null>(null);

  /* -------- Menu -------- */
  if (screen === "menu") {
    return (
      <div className="rmk-lobby">
        <div className="rmk-lobby-title">🎲 拉密 Rummikub</div>
        <div className="rmk-lobby-sub">
          经典数字麻将桌游：凑成顺子或刻子（≥3 张）出牌，破冰需 ≥30 分，率先出完手牌者获胜。
        </div>
        <div className="rmk-lobby-modes">
          <button className="rmk-btn rmk-btn--primary" onClick={() => setScreen("onlineLobby")}>
            🌐 联机对战
          </button>
          <button className="rmk-btn" onClick={() => setScreen("localLobby")}>
            🖥️ 本地同屏
          </button>
        </div>
        <div className="rmk-lobby-note">联机需要已部署 boardgame.io 服务器（见 rummikub-server/README.md）。</div>
      </div>
    );
  }

  /* -------- Local lobby -------- */
  if (screen === "localLobby") {
    return (
      <div className="rmk-lobby">
        <div className="rmk-lobby-title">🎲 拉密 · 本地同屏</div>
        <div className="rmk-lobby-form">
          {localPlayers.map((name, i) => (
            <div className="rmk-field" key={i}>
              <label>玩家 {i + 1} 的名字</label>
              <input
                className="rmk-input"
                value={name}
                maxLength={16}
                onChange={(e) => {
                  const next = [...localPlayers];
                  next[i] = e.target.value || `玩家${i + 1}`;
                  setLocalPlayers(next);
                }}
              />
            </div>
          ))}
        </div>
        <div className="rmk-lobby-modes">
          <button className="rmk-btn rmk-btn--primary" onClick={() => setScreen("localMatch")}>
            ▶ 开始游戏
          </button>
          <button className="rmk-btn" onClick={() => setScreen("menu")}>← 返回</button>
        </div>
      </div>
    );
  }

  /* -------- Local match -------- */
  if (screen === "localMatch") {
    return (
      <div className="rmk-table">
        <div className="rmk-players" style={{ justifyContent: "center" }}>
          {localPlayers.map((name, i) => (
            <button
              key={i}
              className={"rmk-player rmk-player--switch" + (activeLocal === String(i) ? " rmk-player--active" : "")}
              onClick={() => setActiveLocal(String(i))}
              style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}
            >
              <span className="rmk-player-name">{activeLocal === String(i) ? "👉 " : ""}{name}</span>
              <span className="rmk-player-count">P{i + 1}</span>
            </button>
          ))}
          <button className="rmk-btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setScreen("menu")}>退出</button>
        </div>

        <LocalGame
          key={`${localPlayers.join("|")}-${activeLocal}`}
          matchID="local-demo"
          playerID={activeLocal}
          matchData={localPlayers.map((name, i) => ({ id: String(i), name }))}
        />
      </div>
    );
  }

  /* -------- Online lobby -------- */
  if (screen === "onlineLobby") {
    return (
      <OnlineLobby
        defaultName={localPlayers[0] !== "玩家1" ? localPlayers[0] : ""}
        onEnterMatch={(matchID, playerID, creds, players) => {
          setOnline({ matchID, playerID, creds, players });
          setScreen("onlineMatch");
        }}
      />
    );
  }

  /* -------- Online match -------- */
  if (screen === "onlineMatch" && online) {
    return (
      <div className="rmk-table">
        <div className="rmk-lobby-note" style={{ textAlign: "center", marginBottom: 8 }}>
          房间号 <strong>{online.matchID}</strong> · 服务器 {getServerUrl()}
          <button className="rmk-btn" style={{ marginLeft: 8, padding: "4px 10px", fontSize: 12 }} onClick={() => setScreen("menu")}>
            退出房间
          </button>
        </div>
        <OnlineGame
          key={`${online.matchID}-${online.playerID}`}
          matchID={online.matchID}
          playerID={online.playerID}
          credentials={online.creds}
          matchData={online.players.map((name, i) => ({ id: String(i), name }))}
        />
      </div>
    );
  }

  return null;
}
