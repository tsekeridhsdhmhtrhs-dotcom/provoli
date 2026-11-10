// Κάρτα κομματιού στη δημόσια σελίδα Προβολής (#334). Διαβάζει το # του συνδέσμου «#k=<κωδικός>&d=<κάρτα>» (μορφή 3 του
// src/core/kartaKommatiou.js) και το κάνει γραμμές για την οθόνη. Δεν φορτώνει τίποτα (ούτε τον πυρήνα): η κάρτα είναι
// έτοιμα στοιχεία, η σελίδα μόνο τα δείχνει. Αν λείπουν ή χάλασαν, μένει ο κωδικός και τι σημαίνει, όχι σφάλμα.

const APO_B64 = (/** @type {string} */ s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const MORFI_KARTAS = 3;
const KODIKOS = /^([0-9A-Z]{6})-(K\d+|X)-(\d+)(B?)$/i;
// Μεγαλύτερο «d» από αυτό δεν είναι κάρτα ετικέτας (το QR δεν χωράει τόσα): αγνοείται, μένει ο κωδικός
const MEGISTO_D = 4000;
const PARTIDA = /^P(\d{1,6})-(\d{1,6})$/i;

/**
 * Αν το # είναι κάρτα κομματιού: ο κωδικός και η κάρτα (null αν λείπει ή χάλασε). Αλλιώς null (π.χ. σύνδεσμος Σκηνής).
 * Ο κωδικός μόνος του στο # («#HM1SBZ-X-01») είναι κι αυτός κάρτα χωρίς στοιχεία.
 * @param {string} hash
 * @returns {Promise<{ kodikos: string, karta: Record<string, any> | null } | null>}
 */
export async function diavaseKartaHash(hash) {
  const t = String(hash ?? '').replace(/^#/, '');
  if (!t) return null;
  if (KODIKOS.test(t) || PARTIDA.test(t)) return { kodikos: t.toUpperCase(), karta: null };
  const ps = new URLSearchParams(t);
  if (!ps.has('k')) return null;
  const kodikos = String(ps.get('k') ?? '').trim();
  const d = ps.get('d');
  let karta = null;
  if (d && d.length <= MEGISTO_D) {
    try {
      // z=0: η κάρτα γράφτηκε χωρίς συμπίεση (το plug-in δεν είχε CompressionStream)· αλλιώς deflate
      const bytes = APO_B64(d);
      const buf = ps.get('z') === '0' ? bytes : await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      const x = JSON.parse(new TextDecoder().decode(buf));
      // κάρτα από μεγαλύτερη μορφή ή άλλο αντικείμενο: μένει ο κωδικός
      if (x && typeof x === 'object' && x.v === MORFI_KARTAS && Array.isArray(x.m)) karta = x;
    } catch { karta = null; }
  }
  return { kodikos, karta };
}

/** Τι σημαίνει ένας κωδικός ετικέτας. @param {string} kodikos */
export function ennoiaKodikou(kodikos) {
  const k = String(kodikos ?? '').trim();
  const m = KODIKOS.exec(k);
  if (m) {
    const [, id, kouti, ar, b] = m;
    const arithmos = `${Number(ar)}${b ? 'Β' : ''}`;
    const pou = kouti.toUpperCase() === 'X' ? 'στα Έξτρα (κομμάτια SketchUp ή κοπή για τρίτους)' : `του Κουτιού ${Number(kouti.slice(1))}`;
    return `Κομμάτι ${arithmos} ${pou}${b ? ' · Φορά Β' : ''} · Έπιπλο ${id.toUpperCase()}`;
  }
  const p = PARTIDA.exec(k);
  if (p) return `Τεμάχιο ${Number(p[2])} της Παρτίδας ${Number(p[1])}`;
  return 'Κωδικός ετικέτας κομματιού. Δεν τον αναγνωρίζω, αλλά είναι αυτός που γράφει η ετικέτα.';
}

const mm = (/** @type {number} */ v) => String(Math.round(v * 10) / 10);

/**
 * Οι γραμμές της κάρτας για την οθόνη: [όνομα, τιμή], μόνο όσες υπάρχουν.
 * @param {Record<string, any>} k @returns {[string, string][]}
 */
export function grammesKartas(k) {
  /** @type {[string, string][]} */
  const out = [];
  const bale = (/** @type {string} */ onoma, /** @type {unknown} */ v) => { if (v !== undefined && v !== null && String(v).trim() !== '') out.push([onoma, String(v)]); };
  bale('Δουλειά', k.j);
  if (k.o && k.o !== k.e) bale('Έπιπλο', k.e); else if (!k.o) bale('Έπιπλο', k.e);
  bale('Ομάδα', k.o);
  bale('Κομμάτι', [k.t, k.l ? `(${k.l})` : ''].filter(Boolean).join(' '));
  bale('Αριθμός', `${k.n ?? ''}${k.aa ? ` · ${k.aa}` : ''}${k.q ? ` · ${k.q}` : ''}`.replace(/^ · /, ''));
  if (Array.isArray(k.m)) bale('Μέτρα', `${k.m.map(mm).join(' × ')} mm`);
  if (Array.isArray(k.f)) bale('Τελικό', `${k.f.map(mm).join(' × ')} mm`);
  bale('Υλικό', k.y);
  bale('PVC', Array.isArray(k.p) ? k.p.join(' ') : '');
  bale('Φάλτσο', Array.isArray(k.fa) ? k.fa.join(' ') : '');
  bale('CNC', Array.isArray(k.c) ? k.c.join(', ') : '');
  bale('Θέσεις', Array.isArray(k.s) ? k.s.join(' · ') : '');
  return out;
}

const thetikosArithmos = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Το σχέδιο του κομματιού για το 3D (#346), μόνο από την κάρτα του URL: μέτρα, τελικό, φάλτσο, PVC. Τρύπες και κινησιά
 * δεν υπάρχουν στο URL ως σχήμα (μόνο τα ονόματα των .mpr), άρα δεν ζωγραφίζονται. Μονάδα το mm, x το μήκος, y το πλάτος,
 * z το πάχος. Ζωγραφίζεται το τελικό όταν υπάρχει (3D στο τελικό, ADR 0019). Φάλτσο 45°: η πάνω όψη κρατάει όλο το
 * μήκος και η κάτω μικραίνει όσο το πάχος (η κάρτα δεν γράφει ποια όψη κρατάει, υπόθεση, προς επιβεβαίωση).
 * Πλευρές όπως στο CONTEXT: S1, S2 οι κοντές στις άκρες του μήκους (x = 0, x = μήκος), L1, L2 οι μακριές (y = 0, y = πλάτος).
 * Κορυφές: 0–3 κάτω όψη, 4–7 πάνω, και οι δύο αντίστροφα από το (0,0). Επιστρέφει null αν τα μέτρα λείπουν ή δεν είναι έγκυρα.
 * @param {Record<string, any> | null | undefined} k
 * @returns {{ mikos: number, platos: number, paxos: number, teliko: boolean, korifes: number[][], faltso: string[], pvc: { pleura: string, korifes: number[][] }[] } | null}
 */
export function sxedioKommatiou(k) {
  if (!k || !Array.isArray(k.m) || k.m.length < 3 || !k.m.slice(0, 3).every(thetikosArithmos)) return null;
  const [m0, m1, paxos] = k.m;
  const teliko = Array.isArray(k.f) && k.f.length >= 2 && thetikosArithmos(k.f[0]) && thetikosArithmos(k.f[1]);
  const mikos = teliko ? k.f[0] : m0, platos = teliko ? k.f[1] : m1;
  const faltso = (Array.isArray(k.fa) ? k.fa : []).filter((/** @type {string} */ s) => ['L1', 'L2', 'S1', 'S2'].includes(s));
  const eos = (/** @type {string} */ s) => faltso.includes(s);
  // η κάτω όψη κλείνει το πολύ ως τη μέση
  const px = Math.min(paxos, mikos / 2), py = Math.min(paxos, platos / 2);
  const x0 = eos('S1') ? px : 0, x1 = mikos - (eos('S2') ? px : 0), y0 = eos('L1') ? py : 0, y1 = platos - (eos('L2') ? py : 0);
  const korifes = [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [0, 0, paxos], [mikos, 0, paxos], [mikos, platos, paxos], [0, platos, paxos]];
  const OPSEIS = { L1: [0, 1, 5, 4], S2: [1, 2, 6, 5], L2: [2, 3, 7, 6], S1: [3, 0, 4, 7] };
  // PVC μόνο σε σόκορο χωρίς φάλτσο (ADR 0019)
  const pvc = (Array.isArray(k.p) ? k.p : []).filter((/** @type {string} */ s) => s in OPSEIS && !eos(s))
    .map((/** @type {keyof typeof OPSEIS} */ pleura) => ({ pleura, korifes: OPSEIS[pleura].map((i) => korifes[i]) }));
  return { mikos, platos, paxos, teliko, korifes, faltso, pvc };
}

/**
 * Από ποια μεριά να κοιτάει η κάμερα για να φαίνονται τα PVC (αλλιώς το φάλτσο): [πρόσημο στο μήκος, πρόσημο στο πλάτος].
 * S1 στο x = 0 (−), S2 στο x = μήκος (+), L1 στο y = 0 (−), L2 στο y = πλάτος (+). Όταν δεν ορίζεται (καμία, ή οι δύο απέναντι), +.
 * @param {NonNullable<ReturnType<typeof sxedioKommatiou>>} s @returns {[number, number]}
 */
export function meriaKameras(s) {
  const pleures = s.pvc.length ? s.pvc.map((p) => p.pleura) : s.faltso;
  const proso = (/** @type {string} */ a, /** @type {string} */ b) => { const d = (pleures.includes(b) ? 1 : 0) - (pleures.includes(a) ? 1 : 0); return d || 1; };
  return [proso('S1', 'S2'), proso('L1', 'L2')];
}

/**
 * Η γραμμή της μπάντας στο πάνω μέρος της κάρτας: «ΕΠΙΠΛΟ: … · ΟΜΑΔΑ: …», μόνο από όσα έχει η κάρτα (e, o). Κενό αν δεν υπάρχει κανένα.
 * @param {Record<string, any> | null | undefined} k
 */
export function bandaEpiplouOmadas(k) {
  const t = (/** @type {unknown} */ v) => String(v ?? '').trim();
  return [t(k?.e) && `ΕΠΙΠΛΟ: ${t(k?.e)}`, t(k?.o) && `ΟΜΑΔΑ: ${t(k?.o)}`].filter(Boolean).join(' · ');
}
