// src/lib/uiDensity.ts

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

export const getTitleClass = (compactMode: boolean) =>
  compactMode ? "text-2xl font-semibold" : "text-3xl font-semibold";

export const getCardTitleClass = (compactMode: boolean) =>
  compactMode ? "text-base" : "text-lg";

export const getButtonSizeClass = (compactMode: boolean) =>
  compactMode ? "h-9 px-3" : "h-10 px-4";

export const getInputSizeClass = (compactMode: boolean) =>
  compactMode ? "h-9" : "h-10";

export const getIconSizeClass = (compactMode: boolean) =>
  compactMode ? "w-7 h-7" : "w-8 h-8";