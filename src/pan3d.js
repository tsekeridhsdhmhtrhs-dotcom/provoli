// Pan στο 3D με Ctrl + μεσαίο κουμπί (ρόδελα). Κοινό για τη viewer3d.js (σελίδα) και τη skini3d.js (Προβολή, server).
// Δεν φορτώνει τίποτα από τον πυρήνα και δεν υπολογίζει τίποτα· μόνο ρυθμίζει το OrbitControls (ADR 0018).

/**
 * Ctrl + μεσαίο = ΜΟΝΟ pan. Το OrbitControls δεν κάνει preventDefault στο μεσαίο κλικ, οπότε ο browser (Windows) ξεκινά
 * autoscroll και κυλάει πλάγια τη σελίδα· το σταματάμε εδώ. Στο OrbitControls το Ctrl πάνω σε ROTATE σημαίνει pan, ενώ
 * πάνω στο DOLLY (το προεπιλεγμένο του μεσαίου) σημαίνει rotate· γι' αυτό, μόνο όσο κρατιέται Ctrl + μεσαίο, το μεσαίο
 * γίνεται ROTATE. Χωρίς Ctrl το μεσαίο μένει όπως ήταν (zoom).
 * @param {HTMLElement} cv το canvas
 * @param {{ mouseButtons: { MIDDLE: number } }} controls το OrbitControls
 * @param {{ rotate: number, parathyro?: EventTarget }} [o] rotate: THREE.MOUSE.ROTATE (το three μένει έξω, για να δοκιμάζεται
 *   χωρίς browser)· parathyro: πού ακούγεται το άφημα του κουμπιού (προεπιλογή το window)
 */
export function mesaioPan(cv, controls, { rotate, parathyro = window } = /** @type {any} */ ({})) {
  const kanonika = controls.mouseButtons.MIDDLE;
  const epanafora = () => { controls.mouseButtons.MIDDLE = kanonika; };
  const stamata = (/** @type {Event} */ e) => { if (/** @type {MouseEvent} */ (e).button === 1) e.preventDefault(); }; // όχι autoscroll / κύλιση του browser
  for (const typos of ['mousedown', 'mouseup', 'auxclick']) cv.addEventListener(typos, stamata, { capture: true, passive: false });
  cv.addEventListener('pointerdown', (/** @type {Event} */ ev) => {
    const e = /** @type {PointerEvent} */ (ev);
    if (e.pointerType === 'touch' || e.button !== 1) return;
    e.preventDefault();
    controls.mouseButtons.MIDDLE = (e.ctrlKey || e.metaKey) ? rotate : kanonika; // ROTATE + Ctrl = pan
  }, { capture: true, passive: false });
  // σύρσιμο έξω από το canvas: το pointer capture του OrbitControls κρατά τα γεγονότα, εδώ μόνο γυρνάμε τη ρύθμιση πίσω
  parathyro.addEventListener('pointerup', epanafora);
  parathyro.addEventListener('pointercancel', epanafora);
  // δάχτυλα: μόνο το 3D· η σελίδα δεν κυλάει ούτε επιλέγει κείμενο όσο σέρνεις
  Object.assign(cv.style, { touchAction: 'none', overscrollBehavior: 'contain', userSelect: 'none', webkitUserSelect: 'none' });
}
