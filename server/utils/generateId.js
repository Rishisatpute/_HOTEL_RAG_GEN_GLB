// Same format the frontend's OrderStore.genId() has always produced, so
// order ids look identical whether they were minted client-side (before
// this backend existed) or here.
function genId() {
  return 'EP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

module.exports = { genId };
