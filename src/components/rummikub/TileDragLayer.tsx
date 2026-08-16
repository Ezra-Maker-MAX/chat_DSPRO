"use client";

import { useDragLayer } from "react-dnd";
import { TilePreview } from "./Tile";

function getDragLayerStyles(initialOffset: { x: number; y: number } | null, currentOffset: { x: number; y: number } | null) {
  if (!initialOffset || !currentOffset) {
    return { display: "none" };
  }
  const { x, y } = currentOffset;
  const transform = `translate(${x}px, ${y}px)`;
  return { transform, WebkitTransform: transform };
}

const TileDragLayer = function ({ selectedTiles }: { selectedTiles: number[] }) {
  const { item, isDragging, initialOffset, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    initialOffset: monitor.getInitialSourceClientOffset(),
    currentOffset: monitor.getSourceClientOffset(),
    isDragging: monitor.isDragging(),
  }));

  function renderItem() {
    if (!item) return null;
    if (selectedTiles.includes(item.id)) {
      return selectedTiles.map((tileId) => <TilePreview key={tileId} tile={tileId} isDragging={isDragging} />);
    }
    return <TilePreview tile={item.id} isDragging={isDragging} />;
  }

  if (!isDragging) return null;
  return (
    <div className="rmk-drag-layer">
      <div style={getDragLayerStyles(initialOffset, currentOffset)}>{renderItem()}</div>
    </div>
  );
};

export default TileDragLayer;
