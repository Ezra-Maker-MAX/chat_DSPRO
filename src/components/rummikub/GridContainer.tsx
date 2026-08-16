"use client";

import GridSlot from "./GridSlot";

interface GridContainerProps {
  tiles2dArray: (number | null)[][];
  rows: number;
  cols: number;
  canDnD?: boolean;
  gridId: string;
  validTiles?: number[];
  highlightTiles?: boolean;
  selectedTiles: number[];
  moveTiles: (col: number, row: number, gridId: string, tileIdObj: { id: number }, selectedTiles: number[]) => void;
  onTileDragEnd?: () => void;
  onLongPressMouseUp?: () => void;
  handleLongPress?: (tile: number, timeout: number) => void;
  handleTileSelection?: (tile: number, shiftKey: boolean, ctrlKey: boolean) => void;
  hoverPosition: { row: number; col: number; gridId: string } | null;
  setHoverPosition: (pos: { row: number; col: number; gridId: string } | null) => void;
  newlyAdded: number[];
}

const GridContainer = ({
  tiles2dArray,
  rows,
  cols,
  canDnD,
  gridId,
  validTiles,
  highlightTiles,
  selectedTiles,
  moveTiles,
  onTileDragEnd,
  onLongPressMouseUp,
  handleLongPress,
  handleTileSelection,
  hoverPosition,
  setHoverPosition,
  newlyAdded,
}: GridContainerProps) => {
  const gridItems: React.ReactNode[] = [];
  let key = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = tiles2dArray[y] && tiles2dArray[y][x] ? (tiles2dArray[y][x] as number) : undefined;
      gridItems.push(
        <GridSlot
          key={key}
          tile={tile}
          canDnD={canDnD}
          moveTiles={moveTiles}
          onTileDragEnd={onTileDragEnd}
          selectedTiles={selectedTiles}
          handleTileSelection={handleTileSelection}
          handleLongPress={handleLongPress}
          onLongPressMouseUp={onLongPressMouseUp}
          gridId={gridId}
          validTiles={validTiles}
          highlightTiles={highlightTiles}
          row={y}
          col={x}
          hoverPosition={hoverPosition}
          setHoverPosition={setHoverPosition}
          newlyAdded={newlyAdded}
        />
      );
      key++;
    }
  }

  return (
    <div
      className="rmk-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, var(--rmk-tile-w))`,
        gridTemplateRows: `repeat(${rows}, var(--rmk-tile-h))`,
      }}
    >
      {gridItems}
    </div>
  );
};

export default GridContainer;
