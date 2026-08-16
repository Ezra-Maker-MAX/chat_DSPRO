/**
 * Rummikub constants — hardcoded for the chatmosphere game plaza.
 * Adapted from ilov3/rummikub (constants.js) — environment variables removed.
 */
const HAND_ROWS = 2;
const BOARD_ROWS = 9;
const HAND_COLS = 22;
const TILES_TO_DRAW = 14;
const FIRST_MOVE_SCORE_LIMIT = 30;
const BOARD_COLS = 32;
const BOARD_GRID_ID = 'b';
const HAND_GRID_ID = 'h';
const GAME_NAME = 'Rummikub';

const COLOR = {
  red: 0,
  black: 1,
  blue: 2,
  orange: 3,
};
const COLORS = ['red', 'black', 'blue', 'orange'];
const TILE_WIDTH = 2.156;

export {
  HAND_COLS,
  HAND_ROWS,
  FIRST_MOVE_SCORE_LIMIT,
  BOARD_COLS,
  BOARD_ROWS,
  BOARD_GRID_ID,
  HAND_GRID_ID,
  TILES_TO_DRAW,
  GAME_NAME,
  COLORS,
  COLOR,
  TILE_WIDTH,
};
