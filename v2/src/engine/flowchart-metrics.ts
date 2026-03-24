/**
 * Shared geometry constants for the ownership flowchart.
 *
 * Keeping these in one place makes on-canvas layout, resize math,
 * and print rendering agree on what a node's true footprint is.
 */

export const BASE_NODE_WIDTH = 288;
export const BASE_NODE_HEIGHT = 160;
export const BASE_TREE_HORIZONTAL_GAP = 32;
export const BASE_TREE_VERTICAL_GAP = 48;
export const BASE_RELATED_OFFSET_X = BASE_NODE_WIDTH + 16;
export const BASE_ELK_LAYER_GAP = BASE_NODE_HEIGHT * 0.55;
export const BASE_ROOT_TREE_GAP = BASE_TREE_HORIZONTAL_GAP * 4;
export const TREE_SPACING_STEP = 0.25;

export const MIN_NODE_SCALE = 0.2;
export const MAX_NODE_SCALE = 3;
export const MIN_TREE_SPACING_FACTOR = 0.25;
export const MAX_TREE_SPACING_FACTOR = 3;

export function clampNodeScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_NODE_SCALE, Math.max(MIN_NODE_SCALE, scale));
}

export function clampTreeSpacingFactor(factor: number): number {
  if (!Number.isFinite(factor)) return 1;
  return Math.min(MAX_TREE_SPACING_FACTOR, Math.max(MIN_TREE_SPACING_FACTOR, factor));
}

export function getOwnershipNodeDimensions(scale = 1) {
  const safeScale = clampNodeScale(scale);
  return {
    scale: safeScale,
    width: BASE_NODE_WIDTH * safeScale,
    height: BASE_NODE_HEIGHT * safeScale,
  };
}

export function getTreeLayoutMetrics(horizontalSpacingFactor = 1, verticalSpacingFactor = 1, nodeScale = 1) {
  const safeHorizontalSpacingFactor = clampTreeSpacingFactor(horizontalSpacingFactor);
  const safeVerticalSpacingFactor = clampTreeSpacingFactor(verticalSpacingFactor);
  const safeNodeScale = clampNodeScale(nodeScale);
  const relatedGap = BASE_RELATED_OFFSET_X - BASE_NODE_WIDTH;
  const scaledNodeWidth = BASE_NODE_WIDTH * safeNodeScale;
  const scaledNodeHeight = BASE_NODE_HEIGHT * safeNodeScale;

  return {
    nodeWidth: scaledNodeWidth,
    nodeHeight: scaledNodeHeight,
    nodeScale: safeNodeScale,
    horizontalSpacingFactor: safeHorizontalSpacingFactor,
    verticalSpacingFactor: safeVerticalSpacingFactor,
    // Keep card geometry proportional to nodeScale, but keep spacing in stable
    // canvas units so H/V adjustments remain noticeable after the chart is resized.
    horizontalGap: BASE_TREE_HORIZONTAL_GAP * safeHorizontalSpacingFactor,
    verticalGap: BASE_TREE_VERTICAL_GAP * safeVerticalSpacingFactor,
    elkLayerGap: BASE_ELK_LAYER_GAP * safeVerticalSpacingFactor,
    relatedOffsetX: scaledNodeWidth + relatedGap * safeHorizontalSpacingFactor,
    rootGap: BASE_ROOT_TREE_GAP * safeHorizontalSpacingFactor,
  };
}
