module.exports = async function handler(req, res) {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    return res.status(200).json({
      status: 'NO KEY FOUND',
      env_keys: Object.keys(process.env).filter(k => k.includes('STRIPE'))
    });
  }

  return res.status(200).json({
    status: 'KEY EXISTS',
    starts_with: key.substring(0, 8) + '...',
    length: key.length,
    has_quotes: key.includes('"') || key.includes("'"),
    has_spaces: key !== key.trim()
  });
};
