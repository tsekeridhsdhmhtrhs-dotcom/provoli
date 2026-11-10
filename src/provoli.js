// Σελίδα Προβολής (#20, 8Β): ανοίγει από το QR της ετικέτας και δείχνει μόνο το 3D ενός Κουτιού, με το κομμάτι της
// ετικέτας φωτισμένο. Η σελίδα είναι δημόσια, οπότε δεν φορτώνει τίποτα από τον πυρήνα του εργαλείου: ο σύνδεσμος
// φέρνει την έτοιμη Σκηνή (κουτάκια με θέση, χρώμα και πού φεύγουν στο explode, src/core/syndesmos.js) και η
// skini3d.js μόνο τη ζωγραφίζει. Τίποτα δεν αποθηκεύεται, τίποτα δεν αλλάζει. Η κάρτα κομματιού (#334, #346) δείχνει πάνω το
// κομμάτι σε 3D (kommati3d.js) και από κάτω τα στοιχεία. Και τα δύο 3D φορτώνονται μόνο όταν χρειαστούν (import()), ώστε χωρίς
// WebGL, ή αν δεν φορτώσει το three, να μένει η κάρτα.
import { diavaseKartaHash, ennoiaKodikou, grammesKartas, sxedioKommatiou, bandaEpiplouOmadas } from './provoli-karta.js';

const MORFI_SKINIS = 2;
const $ = (id) => document.getElementById(id);
const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- σύνδεσμος ----------
const APO_B64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function apoSyndesmo(hash) {
  const t = String(hash ?? '').replace(/^#/, '');
  if (!t) throw new Error('Ο σύνδεσμος δεν έχει σχέδιο.');
  const teleia = t.indexOf('.');
  const kleidi = teleia >= 0 ? t.slice(0, teleia) : t, kommatiId = teleia >= 0 ? t.slice(teleia + 1) : '';
  let data;
  try {
    const s = new Blob([APO_B64(kleidi)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    data = JSON.parse(new TextDecoder().decode(await new Response(s).arrayBuffer()));
  } catch { throw new Error('Ο σύνδεσμος είναι χαλασμένος ή κομμένος.'); }
  if (!data || typeof data !== 'object') throw new Error('Ο σύνδεσμος δεν είναι σύνδεσμος Προβολής.');
  if (data.v !== MORFI_SKINIS) throw new Error(typeof data.m === 'number' || typeof data.v === 'number' ? 'Η ετικέτα είναι από παλιά έκδοση: τύπωσέ τη ξανά.' : 'Ο σύνδεσμος δεν είναι σύνδεσμος Προβολής.');
  return { skini: data, kommatiId };
}

// ---------- σελίδα ----------
// Το 3D φορτώνεται όταν χρειαστεί και πιάνεται το σφάλμα του: χωρίς WebGL (ή αν δεν φορτώσει το three) μένει η κάρτα, όχι λευκή σελίδα
const exeiWebgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };
let view = null;
async function skini3d() {
  view ??= (await import('./skini3d.js')).neaSkini3d($('viewer3d'));
  return view;
}
let fortomeno = null;
// Το κομμάτι της κάρτας σε 3D (#346), πάνω από τη λίστα. Όποιο σφάλμα και να βγει, το κουτί κρύβεται και μένει η κάρτα.
let k3 = null;
async function deixe3dKommatiou(karta) {
  const box = $('kommati3d');
  box.hidden = true;
  $('kommati3dYpo').hidden = true;
  if (window.provoli) window.provoli.kommati3d = undefined;
  const sxedio = sxedioKommatiou(karta);
  if (!sxedio || !exeiWebgl()) return;
  try {
    box.hidden = false;
    // ένα 3D για όλη τη ζωή της σελίδας· νέος σύνδεσμος (hashchange) ζωγραφίζει ξανά στο ίδιο
    k3 ??= (await import('./kommati3d.js')).neoKommati3d(box);
    k3.zografise(sxedio);
    const ypo = [sxedio.teliko ? 'Σχέδιο στο τελικό μέτρο' : '', sxedio.pvc.length ? 'κόκκινο = PVC' : ''].filter(Boolean).join(' · ');
    $('kommati3dYpo').textContent = ypo;
    $('kommati3dYpo').hidden = !ypo;
    window.provoli.kommati3d = { zografistike: true, kamera: k3.kamera };
  } catch {
    box.hidden = true;
    $('kommati3dYpo').hidden = true;
    box.replaceChildren();
    k3 = null;
  }
}
// Κάρτα κομματιού (#334): κομμάτι χωρίς 3D (Κομμάτια SketchUp, Έξτρα). Με τα στοιχεία του συνδέσμου δείχνει τη λίστα τους,
// χωρίς αυτά τον κωδικό και τι σημαίνει. Ποτέ σελίδα σφάλματος.
async function deixeKarta(r) {
  $('msg').hidden = true;
  $('odigia').hidden = true;
  $('explodeBox').hidden = true;
  $('viewer3d').hidden = true;
  $('karta').hidden = false;
  const k = r.karta;
  $('titlos').textContent = k ? [k.j, k.o || k.e].filter(Boolean).join(' · ') || 'Κομμάτι' : 'Κομμάτι ετικέτας';
  $('ypotitlos').textContent = k ? ennoiaKodikou(r.kodikos) : 'Από το QR της ετικέτας.';
  const b = document.createElement('b'); b.textContent = r.kodikos; $('kommati').replaceChildren(b);
  const grammes = k ? grammesKartas(k) : [['Τι σημαίνει', ennoiaKodikou(r.kodikos)], ['Στοιχεία', 'Ο σύνδεσμος δεν έφερε τα στοιχεία του κομματιού. Δες τα στην ετικέτα.']];
  // createElement + textContent, όχι innerHTML: τα στοιχεία έρχονται από τον σύνδεσμο
  $('kartaGrammes').replaceChildren(...grammes.flatMap(([o, v]) => {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = o; dd.textContent = v;
    return [dt, dd];
  }));
  const banda = bandaEpiplouOmadas(k);
  $('bandaEpiplou').textContent = banda;
  $('bandaEpiplou').hidden = !banda;
  fortomeno = { karta: k, kodikos: r.kodikos };
  await deixe3dKommatiou(k);
}
async function fortose() {
  const msg = $('msg');
  try {
    const karta = await diavaseKartaHash(location.hash);
    if (karta) { await deixeKarta(karta); return; }
    $('karta').hidden = true;
    $('viewer3d').hidden = false;
    if (!exeiWebgl()) throw new Error('Το 3D χρειάζεται WebGL και αυτό το πρόγραμμα περιήγησης δεν το έχει.');
    const { skini, kommatiId } = await apoSyndesmo(location.hash);
    const part = kommatiId ? skini.p.find((p) => p[0] === kommatiId) : null;
    const ta = skini.p.filter((p) => !['legrabox', 'gyali', 'alouminio'].includes(p[1])).length;
    $('titlos').textContent = [skini.d, skini.e].filter(Boolean).join(' · ') || 'Προβολή Κουτιού';
    $('ypotitlos').textContent = `${skini.k ? `${skini.k} · ` : ''}${fmt(skini.m[0])} × ${fmt(skini.m[1])} × ${fmt(skini.m[2])} mm · ${ta} κομμάτια`;
    // όπως στην ετικέτα: ο κωδικός του κομματιού (PL.AR) και οι διαστάσεις του, από τη μεγαλύτερη
    const diast = part ? part.slice(5, 8).sort((a, b) => b - a) : [];
    $('kommati').innerHTML = part ? `<b>${esc(String(part[0]).toUpperCase().replace(/-/g, '.'))}</b> · ${diast.map(fmt).join(' × ')} mm` : '';
    // οι πόρτες ανοιχτές, να φαίνεται το κομμάτι μέσα (εκτός αν η ετικέτα είναι πόρτα ή μέτωπο)
    const anoixtes = !part || !['porta', 'fatsa', 'metopo', 'alouminio'].includes(part[1]);
    fortomeno = { skini, kommatiId };
    msg.hidden = true;
    $('odigia').hidden = false;
    $('explodeBox').hidden = false;
    (await skini3d()).zografise(skini, kommatiId, anoixtes);
  } catch (err) {
    msg.hidden = false;
    msg.className = 'msg lathos';
    msg.textContent = err?.message ?? 'Το σχέδιο δεν ανοίγει.';
  }
}
$('rg-explode').addEventListener('input', (e) => view?.explode(Number(e.target.value) / 100));
$('rg-explode').addEventListener('change', () => view?.kadro());
window.addEventListener('hashchange', fortose);
window.provoli = { get fortomeno() { return fortomeno; } };
fortose();
