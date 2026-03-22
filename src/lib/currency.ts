export const formatCurrency = (value: number | null | undefined, currency = "USD") => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatCompactCurrency = (value: number | null | undefined, currency = "USD") => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
};

export const formatNumber = (value: number | null | undefined) => {
  return Number(value || 0).toLocaleString();
};