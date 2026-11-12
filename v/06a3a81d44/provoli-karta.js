// Κάρτα κομματιού στη δημόσια σελίδα Προβολής (#334). Διαβάζει το # του συνδέσμου «#k=<κωδικός>&d=<κάρτα>» (μορφή 3 του
// src/core/kartaKommatiou.js) και το κάνει γραμμές για την οθόνη. Δεν φορτώνει τίποτα (ούτε τον πυρήνα): η κάρτα είναι
// έτοιμα στοιχεία, η σελίδα μόνο τα δείχνει. Αν λείπουν ή χάλασαν, μένει ο κωδικός και τι σημαίνει, όχι σφάλμα.

const APO_B64 = (/** @type {string} */ s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const MORFI_KARTAS = 3;
const KODIKOS = /^([0-9A-Z]{6})-(K\d+|X)-(\d+)(B?)$/i;
// Μεγαλύτερο «d» από αυτό δεν είναι κάρτα ετικέτας (το QR δεν χωράει τόσα): αγνοείται, μένει ο κωδικός
const MEGISTO_D = 4000;
const PARTIDA = /^P(\d{1,6})-(\d{1,6})$/i;
// Το αναγνωριστικό του αρχείου επίπλου (#355): αντίγραφο του ID_ARXEIOU_EPIPLOU του πυρήνα (το ελέγχει το test/provoli-epiplo.test.js)
const ID_ARXEIOU = /^[A-Za-z0-9_-]{16}$/;
// οι μορφές του αρχείου επίπλου που διαβάζει: 1 (#355) και 2 (#393, πίνακας υλικών), όπως το provoli_pedia.json
const MORFES_ARXEIOU = [1, 2];
// το χρώμα και τα είδη του πίνακα υλικών (μορφή 2), όπως τα timesYlikou του provoli_pedia.json
const XROMA = /^#[0-9a-f]{6}$/;
const EIDI = ['kathreftis', 'tzami'];
// η υφή του υλικού (#395): το τυχαίο όνομα της εικόνας (y/<όνομα>.jpg δίπλα στη σελίδα) και τα όρια του πλάτους της σε mm,
// όπως το timesYlikou.yf και το arithmoiYlikou.pl του provoli_pedia.json. Λάθος τιμή: χωρίς υφή, μένει το χρώμα.
const ONOMA_YFIS = /^[A-Za-z0-9_-]{16}$/;
const ORIA_PLATOUS = [1, 100000];
// Περισσότερα από αυτά δεν είναι αρχείο επίπλου των Αρχείων παραγωγής: δεν ζωγραφίζεται, μένει το κομμάτι
const MEGISTA_KOMMATIA = 3000;
// Περισσότερες κορυφές σε ένα σχήμα (p, #394) δεν είναι Περίγραμμα κύριας όψης: το αρχείο δεν ζωγραφίζεται, μένει το κομμάτι
const MEGISTES_KORYFES = 20000;

/**
 * Αν το # είναι κάρτα κομματιού: ο κωδικός και η κάρτα (null αν λείπει ή χάλασε). Αλλιώς null (π.χ. σύνδεσμος Σκηνής).
 * Ο κωδικός μόνος του στο # («#HM1SBZ-X-01») είναι κι αυτός κάρτα χωρίς στοιχεία. arxeio: το αναγνωριστικό του αρχείου
 * επίπλου («a», #355) αν είναι σωστό, αλλιώς null.
 * @param {string} hash
 * @returns {Promise<{ kodikos: string, karta: Record<string, any> | null, arxeio: string | null } | null>}
 */
export async function diavaseKartaHash(hash) {
  const t = String(hash ?? '').replace(/^#/, '');
  if (!t) return null;
  if (KODIKOS.test(t) || PARTIDA.test(t)) return { kodikos: t.toUpperCase(), karta: null, arxeio: null };
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
  const a = ps.get('a') ?? '';
  return { kodikos, karta, arxeio: ID_ARXEIOU.test(a) ? a : null };
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
 * Το ίδιο όνομα δεν γράφεται δύο φορές (#355): αν Έπιπλο = Ομάδα, μόνο «ΕΠΙΠΛΟ: …».
 * @param {Record<string, any> | null | undefined} k
 */
export function bandaEpiplouOmadas(k) {
  const t = (/** @type {unknown} */ v) => String(v ?? '').trim();
  const e = t(k?.e), o = t(k?.o);
  return [e && `ΕΠΙΠΛΟ: ${e}`, o && o !== e && `ΟΜΑΔΑ: ${o}`].filter(Boolean).join(' · ');
}

const arithmos = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isFinite(v);
const dianysma = (/** @type {unknown} */ v) => Array.isArray(v) && v.length === 3 && v.every(arithmos);

/** @typedef {{ opseis: { epipedo: number[][][], kato: number[][][], pano: number[][][] }[], pleures: number[][][] }} Prisma */
const simeio2 = (/** @type {unknown} */ p) => Array.isArray(p) && p.length === 2 && p.every(arithmos);
/**
 * Αν το σχήμα (p, #394) είναι όπως το γράφει ο πυρήνας: [άξονας 0–2, πάχος > 0, όψεις], κάθε όψη λίστα βρόχων (πρώτα ο
 * εξωτερικός), κάθε βρόχος τουλάχιστον 3 κορυφές [a, b]. @param {unknown} p
 */
function sximaOk(p) {
  if (!Array.isArray(p) || p.length !== 3 || ![0, 1, 2].includes(p[0]) || !arithmos(p[1]) || p[1] <= 0 || !Array.isArray(p[2]) || !p[2].length) return false;
  let plithos = 0;
  for (const o of p[2]) {
    if (!Array.isArray(o) || !o.length) return false;
    for (const l of o) {
      if (!Array.isArray(l) || l.length < 3 || !l.every(simeio2)) return false;
      plithos += l.length;
    }
  }
  return plithos <= MEGISTES_KORYFES;
}

/**
 * Το πρίσμα ενός κομματιού με σχήμα (#394): για κάθε όψη οι βρόχοι στο επίπεδο (epipedo, [a, b], για τα τρίγωνα), κάτω (στο
 * 0 του άξονα) και πάνω (στο πάχος), και οι πλευρές (μία ανά ακμή, όχι η κοινή ακμή δύο εδρών της ίδιας όψης). simeio: τοπικό
 * σημείο → σημείο του σχεδίου. Γεωμετρία του σχεδίου, όχι κανόνας κατασκευής (όπως οι 8 κορυφές του κουτιού).
 * @param {any[]} p @param {(v: number[]) => number[]} simeio @returns {Prisma}
 */
function prisma([aksonas, paxos, opseis], simeio) {
  const [j, k] = [0, 1, 2].filter((x) => x !== aksonas);
  const s3 = (/** @type {number[]} */ [a, b], /** @type {number} */ c) => { const v = [0, 0, 0]; v[aksonas] = c; v[j] = a; v[k] = b; return simeio(v); };
  const kleidi = (/** @type {number[]} */ p, /** @type {number[]} */ q) => [p, q].map((x) => x.join(',')).sort().join('>');
  /** @type {number[][][]} */
  const akmes = [];
  for (const o of opseis) for (const l of o) l.forEach((/** @type {number[]} */ x, /** @type {number} */ i) => akmes.push([x, l[(i + 1) % l.length]]));
  /** @type {Map<string, number>} */
  const fores = new Map();
  for (const [x, q] of akmes) fores.set(kleidi(x, q), (fores.get(kleidi(x, q)) ?? 0) + 1);
  return {
    opseis: opseis.map((/** @type {number[][][]} */ o) => ({ epipedo: o, kato: o.map((l) => l.map((x) => s3(x, 0))), pano: o.map((l) => l.map((x) => s3(x, paxos))) })),
    pleures: akmes.filter(([x, q]) => fores.get(kleidi(x, q)) === 1).map(([x, q]) => [s3(x, 0), s3(q, 0), s3(q, paxos), s3(x, paxos)]),
  };
}

/** Στο 0,1 mm, όπως οι κορυφές του κουτιού. @param {number} v */
const dekato = (v) => Math.round(v * 10) / 10 + 0;

/**
 * Το έπιπλο της κάρτας από το αρχείο επίπλου (#355, μορφή 1 ή 2 του src/core/kartaKommatiou.js, arxeioEpiplou): όλα τα κομμάτια
 * του με τις 8 κορυφές τους (mm, άξονες του επίπλου όπως στο SketchUp: x δεξιά, y βάθος, z πάνω· 0–3 η κάτω όψη, 4–7 η πάνω),
 * φωτεινά όσα έχουν τον αριθμό της κάρτας (n). Το έπιπλο: αυτό με το ίδιο όνομα (Έπιπλο ή Ομάδα της κάρτας) που έχει τον
 * αριθμό, αλλιώς το πρώτο που τον έχει. Μορφή 2 (#393, ADR 0051): κάθε κομμάτι με αναφορά (y) στον πίνακα υλικών έχει και
 * yliko { xroma, eidos: kanoniko / kathreftis / tzami }· τα αγοραζόμενα χωρίς αριθμό (n κενό) δεν φωτίζονται ποτέ.
 * Υφή (#395): το κανονικό υλικό με yf και pl έχει και yfi { src: «y/<yf>.jpg», plato: pl }, και το κομμάτι του τους άξονες
 * των νερών (nera: μήκος, πλάτος, πάχος, μοναδιαία στους άξονες του επίπλου, από το μεγαλύτερο μέτρο στο μικρότερο), ώστε
 * τα νερά να πηγαίνουν κατά το Μήκος (uvYfis). Λάθος yf ή pl: χωρίς υφή, μένει το χρώμα.
 * Το Πλέγμα Όψης (op, #396): plegmaOpsis, τα τρίγωνά του (3 κορυφές το καθένα) ανά υλικό, με την υφή του υλικού (nera οι
 * άξονες του επίπλου: δεν έχει Μήκος)· άδειο χωρίς αυτό.
 * Το Περιβάλλον (#397, ADR 0051): perivallon, στους άξονες του επίπλου της ετικέτας, για να φαίνεται αχνό γύρω του: τα κομμάτια
 * των άλλων επίπλων (kommatia: κορυφές, σχήμα, υλικό χωρίς υφή) και τα τρίγωνα (trigona) του Πλέγματος Όψης τους και του «pe»
 * (Τοίχοι, Πάτωμα, «Walls»). Θέλει τη θέση (m) του επίπλου της ετικέτας, και κάθε άλλου επίπλου· χωρίς, άδειο.
 * null αν το αρχείο δεν διαβάζεται ή δεν έχει το κομμάτι: τότε μένει μόνο το κομμάτι.
 * @param {unknown} arxeio @param {Record<string, any> | null | undefined} karta
 * Από το #394 τα κομμάτια με σχήμα (p) έχουν και το πρίσμα τους (sxima: όψεις και πλευρές, στους άξονες του επίπλου) και
 * (topiko) τα μέτρα και το πρίσμα στους τοπικούς τους άξονες, για το κομμάτι μόνο του (sxedioMonouTou).
 * @returns {{ epiplo: string, kommatia: { n: string, korifes: number[][], fotismeno: boolean, yliko?: { xroma: string, eidos: string, yfi?: { src: string, plato: number } }, nera?: Nera, sxima?: Prisma, topiko?: { d: number[], sxima: Prisma } }[], fotismena: number,
 *   plegmaOpsis: { korifes: number[][], yliko?: { xroma: string, eidos: string, yfi?: { src: string, plato: number } }, nera?: Nera }[],
 *   perivallon: { kommatia: { korifes: number[][], sxima?: Prisma, yliko?: { xroma: string, eidos: string } }[], trigona: { korifes: number[][], yliko?: { xroma: string, eidos: string } }[] } } | null}
 */
export function sxedioEpiplou(arxeio, karta) {
  const a = /** @type {any} */ (arxeio);
  if (!a || typeof a !== 'object' || !MORFES_ARXEIOU.includes(a.v) || !Array.isArray(a.epipla) || !karta) return null;
  const n = String(karta.n ?? '').trim();
  if (!n) return null;
  const v2 = a.v === 2;
  const ylika = v2 ? (a.ylika ?? []) : [];
  if (!Array.isArray(ylika) || !ylika.every((/** @type {any} */ y) => y && typeof y.c === 'string' && XROMA.test(y.c) && (y.ei === undefined || EIDI.includes(y.ei)))) return null;
  // στη μορφή 1 ο αριθμός πάντα· στη 2 όχι στα αγοραζόμενα, και το υλικό, αν υπάρχει, μέσα στον πίνακα
  const kommatiOk = (/** @type {any} */ k) => k && (typeof k.n === 'string' || (v2 && k.n === undefined)) && dianysma(k.d) && k.d.every((/** @type {number} */ x) => x > 0) && dianysma(k.a)
    && Array.isArray(k.x) && k.x.length === 3 && k.x.every(dianysma) && (k.y === undefined || (v2 && Number.isInteger(k.y) && k.y >= 0 && k.y < ylika.length))
    && (k.p === undefined || (v2 && sximaOk(k.p)));
  // το Πλέγμα Όψης (op, μορφή 2, #396): κορυφές p σε τριάδες αριθμών, τρίγωνα t σε τριάδες δεικτών, υλικό μέσα στον πίνακα
  const plegmaOk = (/** @type {any} */ o) => o && Array.isArray(o.p) && o.p.length % 3 === 0 && o.p.every(arithmos) && Array.isArray(o.t) && o.t.length % 3 === 0
    && o.t.every((/** @type {unknown} */ i) => Number.isInteger(i) && /** @type {number} */ (i) >= 0 && /** @type {number} */ (i) < o.p.length / 3)
    && (o.y === undefined || (Number.isInteger(o.y) && o.y >= 0 && o.y < ylika.length));
  // η θέση του επίπλου στο μοντέλο (m, #397): αρχή και τρεις άξονες
  const thesiOk = (/** @type {any} */ m) => m === undefined || (v2 && Array.isArray(m) && m.length === 4 && m.every(dianysma));
  const epipla = a.epipla.filter((/** @type {any} */ e) => e && Array.isArray(e.k) && e.k.length <= MEGISTA_KOMMATIA && e.k.every(kommatiOk)
    && (e.op === undefined || (v2 && Array.isArray(e.op) && e.op.every(plegmaOk))) && thesiOk(e.m));
  if (epipla.length !== a.epipla.length) return null;
  // το Περιβάλλον (pe, μορφή 2, #397): όπως το Πλέγμα Όψης
  if (a.pe !== undefined && !(v2 && Array.isArray(a.pe) && a.pe.every(plegmaOk))) return null;
  const exei = epipla.filter((/** @type {any} */ e) => e.k.some((/** @type {any} */ k) => k.n === n));
  const onomata = [karta.e, karta.o].map((x) => String(x ?? '').trim()).filter(Boolean);
  const e = exei.find((/** @type {any} */ x) => onomata.includes(String(x.e ?? '').trim())) ?? exei[0];
  if (!e) return null;
  const kommatia = e.k.map((/** @type {any} */ k) => kommatiTou(k, n, ylika));
  // κάθε τρίγωνο του Πλέγματος Όψης με τις 3 κορυφές του (mm, άξονες του επίπλου), ένα σύνολο ανά υλικό
  const plegmaOpsis = (e.op ?? []).map((/** @type {any} */ o) => {
    const y = o.y === undefined ? null : ylika[o.y];
    const yfi = yfiYlikou(y);
    return {
      korifes: o.t.map((/** @type {number} */ i) => o.p.slice(i * 3, i * 3 + 3)), ...(y ? { yliko: { xroma: y.c, eidos: y.ei ?? 'kanoniko', ...(yfi ? { yfi } : {}) } } : {}),
      // το Πλέγμα Όψης δεν έχει Μήκος: η υφή στους άξονες του επίπλου (x, y, z)
      ...(yfi ? { nera: /** @type {Nera} */ ({ mikos: [1, 0, 0], platos: [0, 1, 0], paxos: [0, 0, 1] }) } : {}),
    };
  });
  // το Περιβάλλον (#397): μοντέλο → άξονες του επίπλου της ετικέτας (οι άξονές του είναι ορθοκανονικοί: η προβολή σε αυτούς)
  /** @type {{ kommatia: any[], trigona: any[] }} */
  const perivallon = { kommatia: [], trigona: [] };
  if (e.m) {
    const apoMontelo = (/** @type {number[]} */ q) => [1, 2, 3].map((j) => dekato([0, 1, 2].reduce((s, i) => s + (q[i] - e.m[0][i]) * e.m[j][i], 0)));
    const ylikoAxno = (/** @type {number | undefined} */ yi) => (yi === undefined ? {} : { yliko: { xroma: ylika[yi].c, eidos: ylika[yi].ei ?? 'kanoniko' } });
    const trigona = (/** @type {any} */ o, /** @type {(v: number[]) => number[]} */ metaxy) => ({ korifes: o.t.map((/** @type {number} */ i) => metaxy(o.p.slice(i * 3, i * 3 + 3))), ...ylikoAxno(o.y) });
    for (const o of a.pe ?? []) perivallon.trigona.push(trigona(o, apoMontelo));
    for (const f of epipla) {
      if (f === e || !f.m) continue;
      // σημείο του άλλου επίπλου → μοντέλο → επίπλου της ετικέτας
      const metaxy = (/** @type {number[]} */ v) => apoMontelo([0, 1, 2].map((i) => f.m[0][i] + v[0] * f.m[1][i] + v[1] * f.m[2][i] + v[2] * f.m[3][i]));
      for (const k of f.k) {
        const x = kommatiTou(k, '', [], metaxy);
        perivallon.kommatia.push({ korifes: x.korifes, ...(x.sxima ? { sxima: x.sxima } : {}), ...ylikoAxno(k.y) });
      }
      for (const o of f.op ?? []) perivallon.trigona.push(trigona(o, metaxy));
    }
  }
  return { epiplo: String(e.e ?? ''), kommatia, fotismena: kommatia.filter((/** @type {{ fotismeno: boolean }} */ k) => k.fotismeno).length, plegmaOpsis, perivallon };
}

/**
 * Ένα κομμάτι του αρχείου επίπλου με τις 8 κορυφές του, το υλικό, τα νερά και το σχήμα του, στους άξονες του επίπλου, ή (metaxy,
 * #397) όπου τις στέλνει το metaxy (τα άλλα έπιπλα στους άξονες του επίπλου της ετικέτας). n: ο αριθμός της ετικέτας (φωτεινό).
 * @param {any} k @param {string} n @param {any[]} ylika @param {(v: number[]) => number[]} [metaxy]
 */
function kommatiTou(k, n, ylika, metaxy) {
  // τοπικό σημείο (mm από την ελάχιστη γωνία) → άξονες του επίπλου
  const stoEpiplo = (/** @type {number[]} */ v) => {
    const p = [0, 1, 2].map((i) => k.a[i] + k.x[0][i] * v[0] + k.x[1][i] * v[1] + k.x[2][i] * v[2]);
    return (metaxy ? metaxy(p) : p).map(dekato);
  };
  const korifes = [];
  for (const w of [0, 1]) for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) korifes.push(stoEpiplo([u * k.d[0], v * k.d[1], w * k.d[2]]));
  const y = k.y === undefined ? null : ylika[k.y];
  const yfi = yfiYlikou(y);
  // οι άξονες του κομματιού από το μεγαλύτερο μέτρο (Μήκος) στο μικρότερο (πάχος)
  const seira = [0, 1, 2].sort((i, j) => k.d[j] - k.d[i]);
  const nera = yfi ? { nera: /** @type {Nera} */ ({ mikos: k.x[seira[0]], platos: k.x[seira[1]], paxos: k.x[seira[2]] }) } : {};
  return {
    n: k.n ?? '', korifes, fotismeno: k.n === n, ...(y ? { yliko: { xroma: y.c, eidos: y.ei ?? 'kanoniko', ...(yfi ? { yfi } : {}) } } : {}), ...nera,
    // το πραγματικό σχήμα (#394): στο έπιπλο, και (topiko) για το κομμάτι μόνο του
    ...(k.p ? { sxima: prisma(k.p, stoEpiplo), topiko: { d: k.d, sxima: prisma(k.p, (v) => v.map(dekato)) } } : {}),
  };
}

/**
 * Το κομμάτι μόνο του (#394, ADR 0051 απόφαση 10), για το 3D κάτω από το έπιπλο: με αρχείο επίπλου (epiplo, από το
 * sxedioEpiplou) το πραγματικό του σχήμα και το υλικό του. Κομμάτι με σχήμα: το πρίσμα του στους τοπικούς του άξονες (x, y, z
 * όπως το μήκος, πλάτος, πάχος της κάρτας), χωρίς κόκκινο PVC (οι πλευρές L1…S2 της κάρτας δεν δείχνουν ακμή του σχήματος).
 * Ορθογώνιο: το σχέδιο της κάρτας (sxedioKommatiou, με φάλτσο και κόκκινο PVC) με το υλικό του αρχείου. Χωρίς αρχείο ή χωρίς
 * υλικό: όπως το sxedioKommatiou (το ορθογώνιο του ADR 0047). null αν η κάρτα δεν έχει μέτρα.
 * @param {ReturnType<typeof sxedioEpiplou>} epiplo @param {Record<string, any> | null | undefined} karta
 */
export function sxedioMonouTou(epiplo, karta) {
  const s = sxedioKommatiou(karta);
  const k = epiplo?.kommatia.find((x) => x.fotismeno);
  if (!s || !k) return s;
  const yliko = k.yliko ? { yliko: k.yliko } : {};
  if (!k.topiko) return { ...s, ...yliko };
  const [mikos, platos, paxos] = k.topiko.d;
  const korifes = [];
  for (const w of [0, paxos]) for (const [u, v] of [[0, 0], [mikos, 0], [mikos, platos], [0, platos]]) korifes.push([u, v, w]);
  return { mikos, platos, paxos, teliko: false, korifes, faltso: [], pvc: [], sxima: k.topiko.sxima, ...yliko };
}

/**
 * Η υφή ενός υλικού του πίνακα (#395): μόνο κανονικό υλικό με σωστό yf και pl, αλλιώς null (μένει το χρώμα).
 * @param {any} y @returns {{ src: string, plato: number } | null}
 */
function yfiYlikou(y) {
  return y && y.ei === undefined && typeof y.yf === 'string' && ONOMA_YFIS.test(y.yf) && typeof y.pl === 'number' && y.pl >= ORIA_PLATOUS[0] && y.pl <= ORIA_PLATOUS[1]
    ? { src: `y/${y.yf}.jpg`, plato: y.pl } : null;
}

/** Οι άξονες των νερών ενός κομματιού (#395): μοναδιαία διανύσματα στους άξονες του επίπλου. @typedef {{ mikos: number[], platos: number[], paxos: number[] }} Nera */

/**
 * Οι συντεταγμένες υφής (u, v) για τρίγωνα ενός κομματιού (#395), ώστε τα νερά να πηγαίνουν κατά το Μήκος, όπως το «Στρώσε
 * νερά» (ADR 0042): σε κάθε όψη το u κατά το Μήκος (στα σόκορα των κοντών πλευρών κατά το πλάτος), το v κατά τον άλλο
 * άξονα της όψης, σε μονάδες του πλάτους της υφής (plato mm· η αναλογία της εικόνας μπαίνει όταν φορτώσει).
 * @param {number[]} theseis  x, y, z (mm, άξονες του επίπλου) ανά κορυφή, 3 κορυφές ανά τρίγωνο
 * @param {Nera} nera @param {number} plato
 * @returns {number[]} u, v ανά κορυφή
 */
export function uvYfis(theseis, nera, plato) {
  const dot = (/** @type {number[]} */ a, /** @type {number[]} */ b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const uv = [];
  for (let t = 0; t + 8 < theseis.length; t += 9) {
    const [a, b, c] = [0, 3, 6].map((i) => theseis.slice(t + i, t + i + 3));
    const ab = [0, 1, 2].map((i) => b[i] - a[i]), ac = [0, 1, 2].map((i) => c[i] - a[i]);
    const katheti = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const [m, p, x] = [nera.mikos, nera.platos, nera.paxos].map((v) => Math.abs(dot(katheti, v)));
    // η κάθετη της όψης κατά το πάχος: κύρια όψη· κατά το πλάτος: μακρύ σόκορο· κατά το μήκος: κοντό σόκορο
    const [U, V] = x >= p && x >= m ? [nera.mikos, nera.platos] : p >= m ? [nera.mikos, nera.paxos] : [nera.platos, nera.paxos];
    for (const q of [a, b, c]) uv.push(Math.round(dot(q, U) / plato * 1e6) / 1e6 + 0, Math.round(dot(q, V) / plato * 1e6) / 1e6 + 0);
  }
  return uv;
}
