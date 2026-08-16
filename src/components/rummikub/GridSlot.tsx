"use client";

import { useDrop } from "react-dnd";
import { Tile } from "./Tile";

interface GridSlotProps {
  tile?: number;
  col: number;
  row: number;
  moveTiles: (col: number, row: number, gridId: string, tileIdObj: { id: number }, selectedTiles: number[]) => void;
  gridId: string;
  validTiles?: number[];
  highlightTiles?: boolean;
  canDnD?: boolean;
  selectedTiles: number[];
  handleTileSelection?: (tile: number, shiftKey: boolean, ctrlKey: boolean) => void;
  handleLongPress?: (tile: number, timeout: number) => void;
  onTileDragEnd?: () => void;
  onLongPressMouseUp?: () => void;
  hoverPosition: { row: number; col: number; gridId: string } | null;
  setHoverPosition: (pos: { row: number; col: number; gridId: string } | null) => void;
  newlyAdded: number[];
}

const GridSlot = ({
  tile,
  col,
  row,
  moveTiles,
  gridId,
  validTiles,
  highlightTiles,
  canDnD,
  selectedTiles,
  handleTileSelection,
  handleLongPress,
  onTileDragEnd,
  onLongPressMouseUp,
  hoverPosition,
  setHoverPosition,
  newlyAdded,
}: GridSlotProps) => {
  const isSelected = !!tile && selectedTiles.indexOf(tile) !== -1;

  interface DropItem {
    id: number;
  }

  const [{ isOver }, drop] = useDrop<DropItem, unknown, { isOver: boolean }>(
    () => ({
      accept: "tile",
      drop: (tileIdObj) => {
        moveTiles(col, row, gridId, tileIdObj, selectedTiles);
        setHoverPosition(null);
      },
      hover: (item, monitor) => {
        if (monitor.canDrop()) setHoverPosition({ row, col, gridId });
        else setHoverPosition(null);
      },
      canDrop: () => !!canDnD,
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [tile, canDnD, selectedTiles]
  );

  let isHighlighted = false;
  if (hoverPosition && hoverPosition.row === row && hoverPosition.gridId === gridId) {
    const rangeCols = Array.from({ length: selectedTiles.length || 1 }, (_, i) => hoverPosition.col + i);
    isHighlighted = rangeCols.includes(col);
  }

  if (tile) {
    let isValid: boolean | undefined;
    if (highlightTiles && validTiles) {
      isValid = validTiles.indexOf(tile) !== -1;
    }
    return (
      <div ref={drop as unknown as React.Ref<HTMLDivElement>} className="rmk-grid-item" key={tile}>
        <Tile
          tile={tile}
          canDnD={canDnD}
          isValid={isValid}
          isSelected={isSelected}
          onTileDragEnd={onTileDragEnd}
          handleTileSelection={handleTileSelection}
          handleLongPress={handleLongPress}
          onLongPressMouseUp={onLongPressMouseUp}
          selectedTiles={selectedTiles}
          newlyAdded={newlyAdded}
        />
      </div>
    );
  } else {
    return (
      <div
        ref={drop as unknown as React.Ref<HTMLDivElement>}
        className={"rmk-grid-item rmk-grid-slot" + ((canDnD && (isHighlighted || isOver)) ? " rmk-grid-slot--over" : "")}
      />
    );
  }
};

export default GridSlot;
