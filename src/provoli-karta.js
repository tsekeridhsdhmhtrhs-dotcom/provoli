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
