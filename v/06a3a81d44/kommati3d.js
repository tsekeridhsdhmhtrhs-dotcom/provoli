// Το κομμάτι της κάρτας σε 3D (#346): ένα ορθογώνιο κομμάτι με φάλτσο και PVC, από το σχέδιο της provoli-karta.js
// (sxedioKommatiou). Ή (#355) όλο το έπιπλο από το αρχείο επίπλου (sxedioEpiplou): τα κομμάτια αχνά, της ετικέτας
// φωτεινό. Περιστροφή με ένα δάχτυλο, pinch-zoom με δύο (OrbitControls). Δεν φορτώνει τίποτα από τον πυρήνα και δεν
// υπολογίζει διαστάσεις· μόνο ζωγραφίζει ό,τι της δίνουν (ADR 0018). Τρύπες και κινησιά δεν ζωγραφίζονται: δεν υπάρχουν
// ως σχήμα στο URL της κάρτας και δεν προστίθενται στο QR (ADR 0047).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mesaioPan } from './pan3d.js';
import { meriaKameras, uvYfis } from './provoli-karta.js';

const S = 0.001; // mm → m
const XROMA_KORMOU = 0xE2DFD7;
const XROMA_PVC = 0xC8372D; // το ίδιο κόκκινο με το Σημάδι PVC του SketchUp
const XROMA_FOTISMENOU = 0xF28C1E; // το κομμάτι της ετικέτας μέσα στο έπιπλο (#355)
const XROMA_AXNOU = 0xAEB6B2;
// καθρέφτης ασημί γυαλιστερός και τζάμι ημιδιάφανο (#393, ADR 0051): του σχεδίου, όχι του εργοστασίου
const XROMA_KATHREFTI = 0xD4DADE;
const DIAFANEIA_TZAMIOU = 0.3;
// το Περιβάλλον (#397, ADR 0051): αχνό γύρω από το έπιπλο· χωρίς Material ανοιχτό γκρι. Του σχεδίου, όχι του εργοστασίου
const XROMA_PERIVALLONTOS = 0xD9D8D4;
const DIAFANEIA_PERIVALLONTOS = 0.22;
// τα 6 ζεύγη τριγώνων των όψεων του «κουτιού» με κάτω 0–3 και πάνω 4–7 (προς τα έξω)
const TRIGONA = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];

/**
 * Το «κουτί» των 8 κορυφών (κάτω 0–3, πάνω 4–7): δύο τρίγωνα ανά όψη, χωρίς κοινές κορυφές, για επίπεδη σκίαση.
 * @param {THREE.Vector3[]} k
 */
function geometriaKoutiou(k) {
  const pos = [];
  for (const [a, b, c, d] of TRIGONA) for (const i of [a, b, c, a, c, d]) pos.push(k[i].x, k[i].y, k[i].z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Το πρίσμα ενός κομματιού με σχήμα (#394, sxima του provoli-karta.js): οι όψεις σε τρίγωνα (με τις τρύπες τους) κάτω και
 * πάνω, και δύο τρίγωνα ανά πλευρά. Χωρίς κοινές κορυφές, για επίπεδη σκίαση όπως το κουτί.
 * @param {{ opseis: { epipedo: number[][][], kato: number[][][], pano: number[][][] }[], pleures: number[][][] }} sx
 * @param {(p: number[]) => THREE.Vector3} simeio
 */
function geometriaPrismatos(sx, simeio) {
  /** @type {number[]} */
  const pos = [];
  const trigono = (/** @type {THREE.Vector3[]} */ t) => { for (const v of t) pos.push(v.x, v.y, v.z); };
  for (const o of sx.opseis) {
    const [exo, ...tripes] = o.epipedo.map((l) => l.map(([a, b]) => new THREE.Vector2(a, b)));
    const kato = o.kato.flat().map(simeio), pano = o.pano.flat().map(simeio);
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(exo, tripes)) { trigono([kato[a], kato[b], kato[c]]); trigono([pano[a], pano[b], pano[c]]); }
  }
  for (const q of sx.pleures) { const v = q.map(simeio); trigono([v[0], v[1], v[2]]); trigono([v[0], v[2], v[3]]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Η γεωμετρία ενός κομματιού: το πρίσμα του αν έχει σχήμα (#394), αλλιώς το κουτί των 8 κορυφών.
 * @param {{ korifes: number[][], sxima?: Parameters<typeof geometriaPrismatos>[0] }} k @param {(p: number[]) => THREE.Vector3} simeio
 */
const geometria = (k, simeio) => (k.sxima ? geometriaPrismatos(k.sxima, simeio) : geometriaKoutiou(k.korifes.map(simeio)));

/**
 * Ένα 3D μέσα στο el. zografise(sxedio): ζωγραφίζει το κομμάτι. kamera(): γωνία και απόσταση (για έλεγχο).
 * Ρίχνει σφάλμα αν δεν δημιουργηθεί WebGL· ο καλών το πιάνει και κρατά μόνο την κάρτα.
 * @param {HTMLElement} el
 */
export function neoKommati3d(el) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.dampingFactor = 0.12;
  mesaioPan(renderer.domElement, controls, { rotate: THREE.MOUSE.ROTATE });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a908d, 1.6));
  const d1 = new THREE.DirectionalLight(0xffffff, 1.6); d1.position.set(2.5, 4, 3.5); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.6); d2.position.set(-3, 2, -2); scene.add(d2);
  const group = new THREE.Group();
  scene.add(group);
  // το Περιβάλλον (#397) χωριστά: η κάμερα ξεκινά στο έπιπλο (group) και το zoom-out φτάνει ως όλο το Περιβάλλον
  const perivallonGroup = new THREE.Group();
  scene.add(perivallonGroup);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3A403E, transparent: true, opacity: 0.85 });

  // οι υφές (#395): μία φόρτωση ανά εικόνα για όλη τη ζωή της σελίδας· null όταν λείπει (μένει το χρώμα, χωρίς σφάλμα)
  /** @type {Map<string, Promise<THREE.Texture | null>>} */
  const yfes = new Map();
  let metrisiYfon = { zitithikan: 0, fortothikan: 0, leipoun: 0 };
  const fereYfi = (/** @type {string} */ src) => {
    if (!yfes.has(src)) {
      yfes.set(src, new Promise((telos) => new THREE.TextureLoader().load(new URL(src, location.href).href, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        // το v είναι σε μονάδες του πλάτους της υφής· η εικόνα έχει ύψος πλάτος × (ύψος ÷ πλάτος) pixel
        const { width, height } = /** @type {{ width: number, height: number }} */ (t.image);
        if (width && height) t.repeat.set(1, width / height);
        telos(t);
      }, undefined, () => telos(null))));
    }
    return /** @type {Promise<THREE.Texture | null>} */ (yfes.get(src));
  };

  function katharise() {
    for (const g of [group, perivallonGroup]) {
      g.traverse((o) => { const m = /** @type {any} */ (o); if (m.geometry) m.geometry.dispose(); if (m.material && m.material !== lineMat) m.material.dispose(); });
      g.clear();
    }
    metrisiPerivallontos = { trigona: 0, kommatia: 0 };
  }

  /** mm (x μήκος, y πλάτος, z πάχος) → three (x μήκος, y πάχος προς τα πάνω, z πλάτος), κεντραρισμένο. */
  function simeio(/** @type {number[]} */ [x, y, z], /** @type {{ mikos: number, platos: number, paxos: number }} */ s) {
    return new THREE.Vector3((x - s.mikos / 2) * S, (z - s.paxos / 2) * S, (y - s.platos / 2) * S);
  }

  /**
   * Το κομμάτι μόνο του. Από το #394 (sxedioMonouTou) και με το πραγματικό σχήμα (sxima) και το υλικό του (yliko) όταν
   * υπάρχει αρχείο επίπλου· το κόκκινο PVC μένει μόνο εδώ.
   * @param {NonNullable<ReturnType<typeof import('./provoli-karta.js').sxedioMonouTou>>} s
   */
  function zografise(s) {
    katharise();
    const k = s.korifes.map((p) => simeio(p, s));
    const sx = /** @type {{ sxima?: Parameters<typeof geometriaPrismatos>[0], yliko?: { xroma: string } }} */ (s);
    const g = geometria({ korifes: s.korifes, sxima: sx.sxima }, (p) => simeio(p, s));
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: sx.yliko?.xroma ?? XROMA_KORMOU, roughness: 0.75, side: THREE.DoubleSide }));
    mesh.userData.sxima = !!sx.sxima;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), lineMat));
    group.add(mesh);
    // PVC: η όψη του σόκορου, λίγο προς τα έξω για να μη τρεμοπαίζει με το σώμα
    const kentro = k.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(k.length);
    for (const { korifes } of s.pvc) {
      const q = korifes.map((p) => simeio(p, s));
      const fora = q.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(4).sub(kentro).normalize();
      const pg = new THREE.BufferGeometry();
      const v = [q[0], q[1], q[2], q[0], q[2], q[3]].flatMap((p) => [p.x + fora.x * 0.0003, p.y + fora.y * 0.0003, p.z + fora.z * 0.0003]);
      pg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      pg.computeVertexNormals();
      group.add(new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: XROMA_PVC, roughness: 0.5, side: THREE.DoubleSide })));
    }
    // η κάμερα κοιτάει από τη μεριά των PVC (ή του φάλτσου), ώστε να φαίνονται από την αρχή
    const [mx, mz] = meriaKameras(s);
    katefthynsi = new THREE.Vector3(0.55 * mx, 0.7, 0.95 * mz).normalize();
    kadro();
  }

  /**
   * Όλο το έπιπλο (#355): κάθε κομμάτι ένα κουτί από τις 8 κορυφές του (mm, άξονες SketchUp: x δεξιά, y βάθος, z πάνω),
   * φωτεινό το κομμάτι της ετικέτας και τα άλλα αχνά (διάφανα, χωρίς βάθος, ώστε να φαίνεται το φωτεινό από μέσα).
   * Με υλικά (μορφή 2, #393, ADR 0051) τα άλλα με το υλικό τους: το χρώμα τους, ο καθρέφτης ασημί γυαλιστερός, το τζάμι
   * ημιδιάφανο· το περίγραμμα του φωτεινού φαίνεται και πίσω από άλλα κομμάτια. Από το #394 τα κομμάτια με σχήμα (D, καμπύλη,
   * λυγισμένο Εύκαμπτο, φάλτσο) ως πρίσμα. Κόκκινο PVC ποτέ εδώ: μόνο στο κομμάτι μόνο του. Το Πλέγμα Όψης (#396) με το υλικό
   * του (και την υφή του). Επιστρέφει πόσα κομμάτια πήραν κάθε είδος υλικού (για τον έλεγχο).
   * @param {NonNullable<ReturnType<typeof import('./provoli-karta.js').sxedioEpiplou>>} s
   */
  function zografiseEpiplo(s) {
    if (s.kommatia.some((k) => k.yliko) || s.plegmaOpsis?.length || s.perivallon?.kommatia.length || s.perivallon?.trigona.length) return zografiseMeYlika(s);
    katharise();
    trigonaPlegmatos = 0;
    const ola = s.kommatia.flatMap((k) => k.korifes);
    const min = [0, 1, 2].map((i) => Math.min(...ola.map((p) => p[i]))), max = [0, 1, 2].map((i) => Math.max(...ola.map((p) => p[i])));
    const m = min.map((v, i) => (v + max[i]) / 2);
    // SketchUp (x, y, z πάνω) → three (x, y πάνω, z): το μπροστά του επίπλου (−y) προς την κάμερα (+z)
    const simeio = (/** @type {number[]} */ p) => new THREE.Vector3((p[0] - m[0]) * S, (p[2] - m[2]) * S, -(p[1] - m[1]) * S);
    const axno = new THREE.MeshStandardMaterial({ color: XROMA_AXNOU, roughness: 0.8, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const fos = new THREE.MeshStandardMaterial({ color: XROMA_FOTISMENOU, emissive: 0x6A3000, roughness: 0.55, side: THREE.DoubleSide });
    const grammiAxni = new THREE.LineBasicMaterial({ color: 0x5C6865, transparent: true, opacity: 0.35, depthWrite: false });
    for (const k of s.kommatia) {
      const g = geometria(k, simeio);
      const mesh = new THREE.Mesh(g, k.fotismeno ? fos : axno);
      mesh.userData.sxima = !!k.sxima;
      // τα αχνά μετά το φωτεινό, ώστε να μη το σβήνουν
      mesh.renderOrder = k.fotismeno ? 0 : 1;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), k.fotismeno ? lineMat : grammiAxni));
      group.add(mesh);
    }
    // από μπροστά, δεξιά και λίγο από πάνω, όπως το αξονομετρικό του Φύλλου Ομάδας
    katefthynsi = new THREE.Vector3(0.55, 0.6, 0.95).normalize();
    kadro();
    return { kanoniko: 0, kathreftis: 0, tzami: 0 };
  }

  /**
   * Το υλικό του three για ένα υλικό του αρχείου επίπλου (#393). Με υφή (#395) πρώτα το χρώμα, και η εικόνα όταν φορτώσει·
   * αν λείπει, μένει το χρώμα.
   * @param {{ xroma: string, eidos: string, yfi?: { src: string } } | undefined} y
   */
  function ylikoThree(y) {
    if (y?.eidos === 'kathreftis') return new THREE.MeshPhongMaterial({ color: XROMA_KATHREFTI, specular: 0xFFFFFF, shininess: 140, side: THREE.DoubleSide });
    if (y?.eidos === 'tzami') return new THREE.MeshStandardMaterial({ color: y.xroma, roughness: 0.05, transparent: true, opacity: DIAFANEIA_TZAMIOU, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.MeshStandardMaterial({ color: y?.xroma ?? XROMA_KORMOU, roughness: 0.75, side: THREE.DoubleSide });
    if (y?.yfi) {
      const metrisi = metrisiYfon;
      metrisi.zitithikan += 1;
      fereYfi(y.yfi.src).then((t) => {
        if (!t) { metrisi.leipoun += 1; return; }
        m.map = t;
        m.color.set(0xFFFFFF);
        m.needsUpdate = true;
        metrisi.fortothikan += 1;
      });
    }
    return m;
  }

  /** Το έπιπλο με τα υλικά του (μορφή 2, #393). @param {NonNullable<ReturnType<typeof import('./provoli-karta.js').sxedioEpiplou>>} s */
  function zografiseMeYlika(s) {
    katharise();
    const ola = s.kommatia.flatMap((k) => k.korifes);
    const min = [0, 1, 2].map((i) => Math.min(...ola.map((p) => p[i]))), max = [0, 1, 2].map((i) => Math.max(...ola.map((p) => p[i])));
    const m = min.map((v, i) => (v + max[i]) / 2);
    const simeio = (/** @type {number[]} */ p) => new THREE.Vector3((p[0] - m[0]) * S, (p[2] - m[2]) * S, -(p[1] - m[1]) * S);
    const fos = new THREE.MeshStandardMaterial({ color: XROMA_FOTISMENOU, emissive: 0x6A3000, roughness: 0.55, side: THREE.DoubleSide });
    // το περίγραμμα του φωτεινού πάνω από όλα, ώστε να βρίσκεται και μέσα σε κλειστό έπιπλο
    const grammiFos = new THREE.LineBasicMaterial({ color: XROMA_FOTISMENOU, depthTest: false, transparent: true });
    const plithos = { kanoniko: 0, kathreftis: 0, tzami: 0 };
    metrisiYfon = { zitithikan: 0, fortothikan: 0, leipoun: 0 };
    for (const k of s.kommatia) {
      // το πραγματικό σχήμα (#394)· το σόκορο με PVC με το υλικό του κομματιού, όχι κόκκινο (ADR 0051)
      const g = geometria(k, simeio);
      // νερά κατά το Μήκος (#395), και στα κομμάτια με σχήμα: οι θέσεις σε mm με την ίδια σειρά με τη γεωμετρία
      if (!k.fotismeno && k.yliko?.yfi && k.nera) {
        const theseis = k.sxima ? Array.from(geometriaPrismatos(k.sxima, (p) => new THREE.Vector3(p[0], p[1], p[2])).getAttribute('position').array)
          : TRIGONA.flatMap(([a, b, c, d]) => [a, b, c, a, c, d].flatMap((i) => k.korifes[i]));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvYfis(theseis, k.nera, k.yliko.yfi.plato), 2));
      }
      const mesh = new THREE.Mesh(g, k.fotismeno ? fos : ylikoThree(k.yliko));
      mesh.userData.sxima = !!k.sxima;
      // τα ημιδιάφανα (τζάμι) μετά τα αδιάφανα
      mesh.renderOrder = k.yliko?.eidos === 'tzami' ? 1 : 0;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), lineMat));
      if (k.fotismeno) { const p = new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), grammiFos); p.renderOrder = 2; mesh.add(p); }
      group.add(mesh);
      if (!k.fotismeno) plithos[/** @type {keyof typeof plithos} */ (k.yliko?.eidos ?? 'kanoniko')] += 1;
    }
    // το Πλέγμα Όψης (#396): τα τρίγωνά του με το υλικό τους, χωρίς γραμμές (είναι πλέγμα του SketchUp, όχι κουτιά)
    trigonaPlegmatos = 0;
    for (const o of s.plegmaOpsis ?? []) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(o.korifes.flatMap((p) => simeio(p).toArray()), 3));
      g.computeVertexNormals();
      // με υφή (#395): στους άξονες του επίπλου, όπως τα κομμάτια (uvYfis)
      if (o.yliko?.yfi && o.nera) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvYfis(o.korifes.flat(), o.nera, o.yliko.yfi.plato), 2));
      const mesh = new THREE.Mesh(g, ylikoThree(o.yliko));
      mesh.renderOrder = o.yliko?.eidos === 'tzami' ? 1 : 0;
      group.add(mesh);
      trigonaPlegmatos += o.korifes.length / 3;
    }
    zografisePerivallon(s.perivallon, simeio);
    katefthynsi = new THREE.Vector3(0.55, 0.6, 0.95).normalize();
    kadro();
    return plithos;
  }

  /**
   * Το Περιβάλλον (#397, ADR 0051): τα άλλα έπιπλα και τα τρίγωνα (Τοίχοι, Πάτωμα, «Walls»), αχνά (διάφανα, χωρίς βάθος, ώστε
   * να φαίνεται το έπιπλο πίσω τους), με το χρώμα του υλικού τους· χωρίς υλικό ανοιχτό γκρι. Χωρίς υφή.
   * @param {NonNullable<ReturnType<typeof import('./provoli-karta.js').sxedioEpiplou>>['perivallon'] | undefined} p
   * @param {(p: number[]) => THREE.Vector3} simeio
   */
  function zografisePerivallon(p, simeio) {
    const axno = (/** @type {{ xroma: string } | undefined} */ y) => new THREE.MeshStandardMaterial({
      color: y?.xroma ?? XROMA_PERIVALLONTOS, roughness: 0.85, transparent: true, opacity: DIAFANEIA_PERIVALLONTOS, depthWrite: false, side: THREE.DoubleSide,
    });
    const grammiAxni = new THREE.LineBasicMaterial({ color: 0x5C6865, transparent: true, opacity: 0.25, depthWrite: false });
    for (const k of p?.kommatia ?? []) {
      const g = geometria(k, simeio);
      const mesh = new THREE.Mesh(g, axno(k.yliko));
      mesh.renderOrder = 3;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), grammiAxni));
      perivallonGroup.add(mesh);
      metrisiPerivallontos.kommatia += 1;
    }
    for (const o of p?.trigona ?? []) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(o.korifes.flatMap((q) => simeio(q).toArray()), 3));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, axno(o.yliko));
      mesh.renderOrder = 3;
      perivallonGroup.add(mesh);
      metrisiPerivallontos.trigona += o.korifes.length / 3;
    }
  }

  let katefthynsi = new THREE.Vector3(0.55, 0.7, 0.95).normalize();
  // πόσα κομμάτια και τρίγωνα του Περιβάλλοντος ζωγραφίστηκαν (για τον έλεγχο)
  let metrisiPerivallontos = { trigona: 0, kommatia: 0 };
  // πόσα τρίγωνα του Πλέγματος Όψης ζωγραφίστηκαν στο τελευταίο έπιπλο (για τον έλεγχο)
  let trigonaPlegmatos = 0;
  function kadro() {
    resize();
    const oria = new THREE.Box3().setFromObject(group);
    if (oria.isEmpty()) return;
    const sfaira = oria.getBoundingSphere(new THREE.Sphere());
    const vFov = camera.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const gonia = Math.sin(Math.min(vFov, hFov) / 2);
    camera.position.copy(sfaira.center).addScaledVector(katefthynsi, sfaira.radius / gonia * 1.05);
    controls.target.copy(sfaira.center);
    // το zoom-out ως όλο το Περιβάλλον (#397): από το κέντρο του επίπλου, η σφαίρα που χωράει έπιπλο και Περιβάλλον
    const ola = oria.clone().union(new THREE.Box3().setFromObject(perivallonGroup));
    const s = ola.getBoundingSphere(new THREE.Sphere());
    const megisti = perivallonGroup.children.length ? (s.radius + s.center.distanceTo(sfaira.center)) / gonia * 1.05 : Infinity;
    controls.maxDistance = Math.max(megisti, camera.position.distanceTo(controls.target));
    camera.far = Number.isFinite(megisti) ? Math.max(100, megisti * 3) : 100;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(el);
  resize();
  (function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();

  return {
    zografise,
    zografiseEpiplo,
    kadro,
    /** Πόσα τρίγωνα του Πλέγματος Όψης (#396) ζωγραφίστηκαν στο τελευταίο έπιπλο. */
    trigonaPlegmatos: () => trigonaPlegmatos,
    /** Πόσα κομμάτια (άλλων επίπλων) και τρίγωνα του Περιβάλλοντος (#397) ζωγραφίστηκαν στο τελευταίο έπιπλο. */
    perivallon: () => ({ ...metrisiPerivallontos }),
    /** Η γωνία γύρω από τον κατακόρυφο άξονα και η απόσταση της κάμερας από το κέντρο. */
    kamera: () => ({ gonia: controls.getAzimuthalAngle(), apostasi: camera.position.distanceTo(controls.target), megistiApostasi: controls.maxDistance }),
    /** Πόσα κομμάτια (meshes) έχουν σχήμα (και πόσα από αυτά υφή) και πόσα το κόκκινο του PVC, σε ό,τι ζωγραφίστηκε τελευταίο (για τον έλεγχο, #394). */
    metrisi: () => {
      let pvc = 0;
      let sximata = 0;
      let sximataMeYfi = 0;
      group.traverse((o) => {
        const m = /** @type {any} */ (o);
        if (m.isMesh && m.material?.color?.getHex() === XROMA_PVC) pvc += 1;
        if (m.userData.sxima) { sximata += 1; if (m.geometry.getAttribute('uv')) sximataMeYfi += 1; }
      });
      return { pvc, sximata, sximataMeYfi };
    },
    /** Πόσα κομμάτια του τελευταίου επίπλου ζήτησαν υφή, πόσα την πήραν και σε πόσα λείπει (#395, για τον έλεγχο). */
    yfes: () => ({ ...metrisiYfon }),
  };
}
