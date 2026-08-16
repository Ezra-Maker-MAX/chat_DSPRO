"use client";

import { useState, useCallback, useEffect } from "react";
import type { BoardProps } from "boardgame.io/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  HAND_GRID_ID,
  BOARD_GRID_ID,
  BOARD_ROWS,
  BOARD_COLS,
  HAND_ROWS,
  HAND_COLS,
} from "@/lib/rummikub/constants";
import GridContainer from "./GridContainer";
import TileDragLayer from "./TileDragLayer";
import GameOverModal from "./GameOverModal";
import { extractSeqs, isBoardHasNewTiles, isBoardValid } from "@/lib/rummikub/moveValidation";
import { buildGridsFromTilePositions, getSecTs, isSequenceValid, stringToColor } from "@/lib/rummikub/util";
import { handleTileSelection } from "@/lib/rummikub/boardUtil";
import _ from "lodash";

type RummikubBoardProps = BoardProps<any> & {
  matchData?: any[];
  matchID?: string;
};

const RummikubBoard = function ({ G, ctx, moves, playerID, matchData, matchID, events }: RummikubBoardProps) {
  const [recentlyDrawnTiles, setRecentlyDrawnTiles] = useState<number[]>([]);
  const [state, setState] = useState<{ selectedTiles: number[]; lastSelectedTileId: number | null }>({
    selectedTiles: [],
    lastSelectedTileId: null,
  });
  const [showInvalidTiles, setShowInvalidTiles] = useState(false);
  const [validTiles, setValidTiles] = useState<number[]>([]);
  const [hoverPosition, setHoverPosition] = useState<{ row: number; col: number; gridId: string } | null>(null);

  useEffect(() => {
    if (playerID === "0" && ctx.phase === "playersJoin" && _.every(matchData, (item: any) => item?.name)) {
      events?.endPhase?.();
    }
  }, [matchData, ctx.phase, playerID, events]);

  useEffect(() => {
    if (G.recentlyDrawnTiles?.length) {
      setRecentlyDrawnTiles(G.recentlyDrawnTiles);
      const timeout = setTimeout(() => {
        setRecentlyDrawnTiles([]);
        moves.clearRecentlyDrawnTiles?.({ G, ctx });
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [G.recentlyDrawnTiles, moves, G, ctx]);

  const moveTilesUseCb = useCallback(
    (col: number, row: number, destGridId: string, tileIdObj: { id: number }, selectedTiles: number[]) => {
      moves.moveTiles(col, row, destGridId, tileIdObj, selectedTiles);
    },
    [moves]
  );

  const handleTileSelectionCb = useCallback(
    (tileId: number, shiftKey: boolean, ctrlKey: boolean) => {
      handleTileSelection(G, state, setState, playerID, tileId, shiftKey, ctrlKey);
    },
    [G, playerID, state]
  );

  const onTileDragEnd = useCallback(() => {
    setState({ selectedTiles: [], lastSelectedTileId: null });
  }, []);

  function onBoardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const classList = target.className?.split?.(" ") || [];
    const isTileClick = classList.includes("rmk-tile") || classList.includes("rmk-tile-face");

    if (!isTileClick) {
      setState((prev) => {
        if (prev.selectedTiles.length === 0 && prev.lastSelectedTileId === null) return prev;
        return { selectedTiles: [], lastSelectedTileId: null };
      });
    }
  }

  function drawTile() {
    moves.drawTile(!isBoardValid(G));
  }

  function endTurn() {
    const seqs = extractSeqs(G);
    const _validTiles: number[] = [];
    for (const seq of seqs) {
      if (isSequenceValid(seq)) {
        for (const tile of seq) _validTiles.push(tile);
      }
    }
    setValidTiles(_validTiles);
    setShowInvalidTiles(true);
    setTimeout(() => {
      setShowInvalidTiles(false);
      moves.endTurn();
    }, 600);
  }

  function onTimeout() {
    endTurn();
  }

  const checkTimerExpired = useCallback(
    (timerId: number) => {
      if (ctx.gameover) clearInterval(timerId);
      if (G.timerExpireAt) {
        const secondsLeft = G.timerExpireAt - getSecTs();
        if (secondsLeft <= 0 && playerID === ctx.currentPlayer) onTimeout();
      }
    },
    [G.timerExpireAt, ctx.currentPlayer, ctx.gameover]
  );

  useEffect(() => {
    if (!G.timerExpireAt || ctx.gameover) return;
    const timerId = window.setInterval(() => checkTimerExpired(timerId as unknown as number), 500);
    return () => clearInterval(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G.timerExpireAt, ctx.currentPlayer, ctx.gameover]);

  const { board, hands } = buildGridsFromTilePositions(G.tilePositions, ctx.numPlayers);
  const myHand = hands[parseInt(playerID || "0")] || [];
  const isMyTurn = ctx.currentPlayer === playerID;

  const boardGrid = (
    <GridContainer
      rows={BOARD_ROWS}
      cols={BOARD_COLS}
      tiles2dArray={board}
      gridId={BOARD_GRID_ID}
      canDnD={isMyTurn}
      moveTiles={moveTilesUseCb}
      highlightTiles={showInvalidTiles}
      validTiles={validTiles}
      selectedTiles={state.selectedTiles}
      onTileDragEnd={onTileDragEnd}
      handleTileSelection={handleTileSelectionCb}
      hoverPosition={hoverPosition}
      setHoverPosition={setHoverPosition}
      newlyAdded={[]}
    />
  );

  const handGrid = (
    <GridContainer
      rows={HAND_ROWS}
      cols={HAND_COLS}
      tiles2dArray={myHand}
      gridId={HAND_GRID_ID}
      canDnD={true}
      highlightTiles={false}
      moveTiles={moveTilesUseCb}
      selectedTiles={state.selectedTiles}
      onTileDragEnd={onTileDragEnd}
      handleTileSelection={handleTileSelectionCb}
      hoverPosition={hoverPosition}
      setHoverPosition={setHoverPosition}
      newlyAdded={recentlyDrawnTiles}
    />
  );

  // Player status strip (BGA-style seats with timer ring on the active player)
  const players = (matchData || []).map((pd, i) => ({
    name: pd?.name || `Player ${i + 1}`,
    tiles: hands[i]?.flat().filter(Boolean).length || 0,
    active: String(ctx.currentPlayer) === String(i),
  }));

  // Active player's turn progress for the timer ring (0..100).
  const ringProgress = (() => {
    if (ctx.gameover || !G.timerExpireAt || !G.timePerTurn) return null;
    const remain = G.timerExpireAt - getSecTs();
    const pct = Math.round((remain / G.timePerTurn) * 100);
    return Math.max(0, Math.min(100, pct));
  })();

  const drawOrEnd = G.tilesPool.length > 0 && !isBoardHasNewTiles(G) ? "draw" : "end";

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="rmk-table">
        {ctx.gameover && (
          <GameOverModal gameover={ctx.gameover} matchId={matchID} playerID={playerID || "0"} matchData={matchData} />
        )}

        {/* Players strip */}
        <div className="rmk-players">
          {players.map((p, i) => (
            <div key={i} className={"rmk-player" + (p.active ? " rmk-player--active" : "")}>
              {p.active && ringProgress !== null && (
                <span
                  className="rmk-timer-ring"
                  style={{ "--rmk-progress": ringProgress } as React.CSSProperties}
                />
              )}
              <span
                className="rmk-player-dot"
                style={{ background: stringToColor(p.name) }}
              />
              <span className="rmk-player-name">{p.name}</span>
              <span className="rmk-player-count">{p.tiles}</span>
            </div>
          ))}
          <span className="rmk-pool">🂠 剩余 {G.tilesPool?.length ?? 0}</span>
        </div>

        {/* Board felt */}
        <div className="rmk-board" onClick={onBoardClick}>
          {boardGrid}
        </div>

        {/* Hand rack + controls */}
        <div className="rmk-hand">
          <div className="rmk-hand-label">
            <span>我的手牌</span>
            {isMyTurn ? <span className="rmk-turn-hint" style={{ color: "var(--color-accent-glow)" }}>● 你的回合</span> : null}
          </div>
          {handGrid}
          <div className="rmk-controls">
            <button
              className="rmk-btn"
              disabled={!isMyTurn || ctx.gameover}
              title="按颜色排序"
              onClick={() => moves.orderByColorVal()}
            >
              789
            </button>
            <button
              className="rmk-btn"
              disabled={!isMyTurn || ctx.gameover}
              title="按点数排序"
              onClick={() => moves.orderByValColor()}
            >
              777
            </button>
            {drawOrEnd === "draw" ? (
              <button
                className="rmk-btn rmk-btn--primary"
                disabled={!isMyTurn || !G.tilesPool.length || ctx.gameover || ctx.phase === "playersJoin"}
                title="摸一张牌并结束回合"
                onClick={() => drawTile()}
              >
                摸牌
              </button>
            ) : (
              <button
                className="rmk-btn rmk-btn--success"
                disabled={!isMyTurn || ctx.gameover}
                onClick={() => endTurn()}
              >
                结束回合
              </button>
            )}
            <button className="rmk-btn rmk-btn--danger" disabled={!G.gameStateStack?.length || ctx.gameover || !isMyTurn} onClick={() => moves.undo()}>
              撤销
            </button>
            <button className="rmk-btn" disabled={!G.redoMoveStack?.length || ctx.gameover || !isMyTurn} onClick={() => moves.redo()}>
              重做
            </button>
          </div>
        </div>

        <TileDragLayer selectedTiles={state.selectedTiles} />
      </div>
    </DndProvider>
  );
};

export default RummikubBoard;
