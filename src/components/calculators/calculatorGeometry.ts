export interface CalculatorPosition {
  x: number;
  y: number;
}

export interface CalculatorSize {
  width: number;
  height: number;
}

export type CalculatorResizeMode = 'right' | 'bottom' | 'corner';

export const DEFAULT_CALCULATOR_SIZE: CalculatorSize = {
  width: 440,
  height: 520,
};

const MIN_CALCULATOR_SIZE: CalculatorSize = {
  width: 420,
  height: 430,
};

const MAX_CALCULATOR_WIDTH = 780;
const CHAT_WIDGET_WIDTH = 360;
const CHAT_WIDGET_GAP = 12;
const CHAT_RIGHT_OFFSET = 24;
const SIDEBAR_SAFE_OFFSET = 304;
const VIEWPORT_PADDING = 10;

function getCalculatorMinX() {
  return window.innerWidth > 900 ? SIDEBAR_SAFE_OFFSET : VIEWPORT_PADDING;
}

function getReservedChatWidth(openInternalChatsCount: number) {
  if (openInternalChatsCount <= 0) return 0;

  const estimatedWidth = openInternalChatsCount * CHAT_WIDGET_WIDTH
    + Math.max(0, openInternalChatsCount - 1) * CHAT_WIDGET_GAP;
  const maxStackWidth = Math.max(CHAT_WIDGET_WIDTH, window.innerWidth - 328);
  return Math.min(estimatedWidth, maxStackWidth);
}

function getCalculatorMaxX(size: CalculatorSize, openInternalChatsCount: number) {
  const viewportMaxX = window.innerWidth - size.width - VIEWPORT_PADDING;

  if (openInternalChatsCount <= 0) {
    return viewportMaxX;
  }

  const chatLeft = window.innerWidth - CHAT_RIGHT_OFFSET - getReservedChatWidth(openInternalChatsCount);
  return Math.min(viewportMaxX, chatLeft - CHAT_WIDGET_GAP - size.width);
}

export function getSafeCalculatorSize(size: CalculatorSize): CalculatorSize {
  const maxWidth = Math.max(
    MIN_CALCULATOR_SIZE.width,
    Math.min(MAX_CALCULATOR_WIDTH, window.innerWidth - getCalculatorMinX() - VIEWPORT_PADDING),
  );
  const maxHeight = Math.max(MIN_CALCULATOR_SIZE.height, window.innerHeight - (VIEWPORT_PADDING * 2));

  return {
    width: Math.max(MIN_CALCULATOR_SIZE.width, Math.min(maxWidth, size.width)),
    height: Math.max(MIN_CALCULATOR_SIZE.height, Math.min(maxHeight, size.height)),
  };
}

export function getSafeCalculatorPosition(
  position: CalculatorPosition,
  size: CalculatorSize,
  openInternalChatsCount: number,
): CalculatorPosition {
  const minX = getCalculatorMinX();
  const maxX = Math.max(minX, getCalculatorMaxX(size, openInternalChatsCount));
  const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - size.height - VIEWPORT_PADDING);

  return {
    x: Math.max(minX, Math.min(maxX, position.x)),
    y: Math.max(VIEWPORT_PADDING, Math.min(maxY, position.y)),
  };
}

export function getCalculatorTriggerRight(openInternalChatsCount: number) {
  if (openInternalChatsCount <= 0) return CHAT_RIGHT_OFFSET;

  const reservedWidth = getReservedChatWidth(openInternalChatsCount);
  const desiredRight = CHAT_RIGHT_OFFSET + reservedWidth + 16;
  return Math.min(desiredRight, Math.max(CHAT_RIGHT_OFFSET, window.innerWidth - 80));
}
