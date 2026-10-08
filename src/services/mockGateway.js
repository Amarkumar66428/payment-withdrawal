/**
 * Stand-in payment gateway (no external API). Same `reference` always gets the same result
 * so retries never double-pay.
 */
const config = require("../../config");

class GatewayTransientError extends Error {}

const results = new Map();
const flakySeen = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const payout = async ({ reference, amount, destination }) => {
  await sleep(20 + Math.random() * 80);

  if (results.has(reference)) return results.get(reference);

  const handle = destination.upiId || "";
  if (handle.startsWith("flaky") && !flakySeen.has(reference)) {
    flakySeen.add(reference);
    throw new GatewayTransientError("gateway timeout");
  }

  let result;
  if (handle.startsWith("fail")) {
    result = { status: "failed", reason: "BENEFICIARY_ACCOUNT_INVALID" };
  } else {
    const roll = Math.random();
    if (roll < config.gateway.transientRate)
      throw new GatewayTransientError("gateway 503");
    result =
      roll < config.gateway.transientRate + config.gateway.failRate
        ? { status: "failed", reason: "BENEFICIARY_BANK_DECLINED" }
        : { status: "success", gatewayTxnId: `MOCK-${reference}-${amount}` };
  }

  results.set(reference, result);
  return result;
};

module.exports = { payout, GatewayTransientError };
