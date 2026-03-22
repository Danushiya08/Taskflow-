export const formatCurrency = (
  value: number | null | undefined,
  currency = "USD",
  locale = "en-US"
) => {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatCompactCurrency = (
  value: number | null | undefined,
  currency = "USD",
  locale = "en-US"
) => {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
};

export const formatNumber = (value: number | null | undefined, locale = "en-US") => {
  return Number(value ?? 0).toLocaleString(locale);
};