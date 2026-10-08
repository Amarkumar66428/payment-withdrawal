const tails = new Map();

const withKeyLock = async (key, fn) => {
  const k = String(key);
  const previous = tails.get(k) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => (release = resolve));
  const tail = previous.then(() => current);
  tails.set(k, tail);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (tails.get(k) === tail) tails.delete(k);
  }
};

module.exports = { withKeyLock };
