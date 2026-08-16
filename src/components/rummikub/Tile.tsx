"use client";

import { useCallback, useEffect, useState } from "react";
import { getTileValue, isJoker, getTileColor } from "@/lib/rummikub/util";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import { COLORS } from "@/lib/rummikub/constants";
import { Sparkles } from "lucide-react";

/** Tile value → display face. */
function tileFace(tile: number) {
  if (isJoker(tile)) return <Sparkles size={18} strokeWidth={2.5} />;
  return getTileValue(tile);
}

/** Tile color class for dark theme (black tiles get ivory text, others bright). */
function colorClass(tile: number) {
  return "rmk-tile--" + COLORS[getTileColor(tile)];
}

export function TilePreview({
  tile,
  isSelected,
  isDragging,
  isValid,
  newlyAdded,
}: {
  tile: number;
  isSelected?: boolean;
  isDragging?: boolean;
  isValid?: boolean;
  newlyAdded?: boolean;
}) {
  if (!tile) return null;

  let cls = "rmk-tile " + colorClass(tile);
  if (isSelected) cls += " rmk-tile--selected";
  if (isValid === true) cls += " rmk-tile--valid";
  else if (isValid === false) cls += " rmk-tile--invalid";
  if (newlyAdded) cls += " rmk-tile--new";
  if (isDragging) cls += " rmk-tile--dragging";

  return (
    <div className={cls}>
      <span className="rmk-tile-face">{tileFace(tile)}</span>
      <span className="rmk-tile-sub" />
    </div>
  );
}

export function Tile({
  tile,
  canDnD,
  isSelected,
  isValid,
  handleTileSelection,
  onTileDragEnd,
  handleLongPress,
  onLongPressMouseUp,
  selectedTiles,
  newlyAdded,
}: {
  tile: number;
  canDnD?: boolean;
  isSelected?: boolean;
  isValid?: boolean;
  handleTileSelection?: (tile: number, shiftKey: boolean, ctrlKey: boolean) => void;
  onTileDragEnd?: () => void;
  handleLongPress?: (tile: number, timeout: number) => void;
  onLongPressMouseUp?: () => void;
  selectedTiles?: number[];
  newlyAdded?: number[];
}) {
  const longPressTimeout = 250;
  const [longPressTriggered, setLongPress] = useState(false);

  interface DragItem {
    id: number;
    selectedTiles?: number[];
    draggedIndex: number;
  }

  const [{ isDragging }, drag, preview] = useDrag<DragItem, unknown, { isDragging: boolean }>(
    () => ({
      type: "tile",
      item: () => {
        const draggedIndex = selectedTiles?.indexOf(tile) ?? -1;
        return { id: tile, selectedTiles, draggedIndex };
      },
      end: (draggedItem, monitor) => {
        if (monitor.didDrop()) onTileDragEnd?.();
      },
      canDrag: () => !!canDnD,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [canDnD, selectedTiles]
  );

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (longPressTriggered) {
        setLongPress(false);
        return;
      }
      if (!(e.altKey || e.metaKey)) {
        handleTileSelection?.(tile, e.shiftKey, e.ctrlKey);
      }
    },
    [longPressTriggered, handleTileSelection, tile]
  );

  return (
    <div
      onClick={onClick}
      onMouseUp={onLongPressMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress?.(tile, longPressTimeout);
      }}
      ref={drag as unknown as React.Ref<HTMLDivElement>}
      id={String(tile)}
      className={canDnD ? "rmk-tile-clickable" : ""}
    >
      <TilePreview
        tile={tile}
        isSelected={isSelected}
        isDragging={isDragging}
        isValid={isValid}
        newlyAdded={newlyAdded?.includes(tile)}
      />
    </div>
  );
}

export default Tile;
