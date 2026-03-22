export const getPagePaddingClass = (compactMode: boolean) =>
  compactMode ? "p-4 space-y-4" : "p-6 space-y-6";

export const getCardPaddingClass = (compactMode: boolean) =>
  compactMode ? "pt-4" : "pt-6";

export const getGridGapClass = (compactMode: boolean) =>
  compactMode ? "gap-4" : "gap-6";

export const getStackGapClass = (compactMode: boolean) =>
  compactMode ? "space-y-3" : "space-y-4";

export const getTextSizeClass = (compactMode: boolean) =>
  compactMode ? "text-sm" : "text-base";