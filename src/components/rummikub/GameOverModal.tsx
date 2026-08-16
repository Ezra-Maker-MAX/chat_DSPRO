"use client";

import { useState } from "react";

interface GameOverModalProps {
  gameover: { winner: string; points: Record<string, number> };
  matchId?: string;
  playerID?: string;
  matchData?: { name?: string }[];
}

const GameOverModal = function ({ gameover, matchData }: GameOverModalProps) {
  const [leaving, setLeaving] = useState(false);
  const winner = matchData?.[parseInt(gameover.winner)]?.name || `Player ${gameover.winner}`;
  const winnerPoints = gameover.points?.[gameover.winner] ?? 0;

  const sorted = Object.entries(gameover.points || {}).sort((a, b) => Number(b[0]) - Number(a[0]));

  return (
    <div className="rmk-over-backdrop">
      <div className="rmk-over-modal">
        <h2 className="rmk-over-title">🎉 {winner} 获胜！</h2>
        <p className="rmk-over-points">
          总得分 <strong>{winnerPoints}</strong>
        </p>
        <ul className="rmk-over-list">
          {sorted.map(([pid, pts]) => (
            <li key={pid} className="rmk-over-item">
              <span>{matchData?.[parseInt(pid)]?.name || `玩家 ${pid}`}</span>
              <strong>{pts} 分</strong>
            </li>
          ))}
        </ul>
        <div className="rmk-over-actions">
          <button className="rmk-btn rmk-btn--primary" disabled={leaving} onClick={() => setLeaving(true)}>
            {leaving ? "离开中…" : "返回大厅"}
          </button>
          <button className="rmk-btn" onClick={() => window.location.reload()}>
            🔁 再来一局
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal;
