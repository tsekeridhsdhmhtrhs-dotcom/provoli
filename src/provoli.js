// Σελίδα Προβολής (#20, 8Β): ανοίγει από το QR της ετικέτας και δείχνει μόνο το 3D ενός Κουτιού, με το κομμάτι της
// ετικέτας φωτισμένο. Η σελίδα είναι δημόσια, οπότε δεν φορτώνει τίποτα από τον πυρήνα του εργαλείου: ο σύνδεσμος
// φέρνει την έτοιμη Σκηνή (κουτάκια με θέση, χρώμα και πού φεύγουν στο explode, src/core/syndesmos.js) και η
// skini3d.js μόνο τη ζωγραφίζει. Τίποτα δεν αποθηκεύεται, τίποτα δεν αλλάζει.
import { neaSkini3d } from './skini3d.js';

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
const view = neaSkini3d($('viewer3d'));
let fortomeno = null;
async function fortose() {
  const msg = $('msg');
  try {
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
    view.zografise(skini, kommatiId, anoixtes);
  } catch (err) {
    msg.hidden = false;
    msg.className = 'msg lathos';
    msg.textContent = err?.message ?? 'Το σχέδιο δεν ανοίγει.';
  }
}
$('rg-explode').addEventListener('input', (e) => view.explode(Number(e.target.value) / 100));
$('rg-explode').addEventListener('change', () => view.kadro());
window.addEventListener('hashchange', fortose);
window.provoli = { get fortomeno() { return fortomeno; } };
fortose();
