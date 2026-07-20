function generateId(prefix) {
  const random = Math.floor(100000 + Math.random() * 900000);
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${timestamp}${random}`;
}

module.exports = { generateId };
