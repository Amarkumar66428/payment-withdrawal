const AMOUNT_PATTERN = /^(\d{1,12})(?:\.(\d{1,2}))?$/;

const toPaise = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = typeof value === "number" ? String(value) : value.trim();
  const match = AMOUNT_PATTERN.exec(text);
  if (!match) return null;
  const paise =
    Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
};

// 15050 -> "150.50"
const formatPaise = (paise) => {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};

module.exports = { toPaise, formatPaise };
