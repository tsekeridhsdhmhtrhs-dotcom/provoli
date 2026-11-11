// Το κομμάτι της κάρτας σε 3D (#346): ένα ορθογώνιο κομμάτι με φάλτσο και PVC, από το σχέδιο της provoli-karta.js
// (sxedioKommatiou). Ή (#355) όλο το έπιπλο από το αρχείο επίπλου (sxedioEpiplou): τα κομμάτια αχνά, της ετικέτας
// φωτεινό. Περιστροφή με ένα δάχτυλο, pinch-zoom με δύο (OrbitControls). Δεν φορτώνει τίποτα από τον πυρήνα και δεν
// υπολογίζει διαστάσεις· μόνο ζωγραφίζει ό,τι της δίνουν (ADR 0018). Τρύπες και κινησιά δεν ζωγραφίζονται: δεν υπάρχουν
// ως σχήμα στο URL της κάρτας και δεν προστίθενται στο QR (ADR 0047).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mesaioPan } from './pan3d.js';
import { meriaKameras } from './provoli-karta.js';

const S = 0.001; // mm → m
const XROMA_KORMOU = 0xE2DFD7;
const XROMA_PVC = 0xC8372D; // το ίδιο κόκκινο με το Σημάδι PVC του SketchUp
const XROMA_FOTISMENOU = 0xF28C1E; // το κομμάτι της ετικέτας μέσα στο έπιπλο (#355)
const XROMA_AXNOU = 0xAEB6B2;
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
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3A403E, transparent: true, opacity: 0.85 });

  function katharise() {
    group.traverse((o) => { const m = /** @type {any} */ (o); if (m.geometry) m.geometry.dispose(); if (m.material && m.material !== lineMat) m.material.dispose(); });
    group.clear();
  }

  /** mm (x μήκος, y πλάτος, z πάχος) → three (x μήκος, y πάχος προς τα πάνω, z πλάτος), κεντραρισμένο. */
  function simeio(/** @type {number[]} */ [x, y, z], /** @type {{ mikos: number, platos: number, paxos: number }} */ s) {
    return new THREE.Vector3((x - s.mikos / 2) * S, (z - s.paxos / 2) * S, (y - s.platos / 2) * S);
  }

  function zografise(/** @type {NonNullable<ReturnType<typeof import('./provoli-karta.js').sxedioKommatiou>>} */ s) {
    katharise();
    const k = s.korifes.map((p) => simeio(p, s));
    const g = geometriaKoutiou(k);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: XROMA_KORMOU, roughness: 0.75, side: THREE.DoubleSide }));
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
   * Τα φάλτσα δεν ζωγραφίζονται εδώ: τα δείχνει το κομμάτι μόνο του και η κάρτα.
   * @param {NonNullable<ReturnType<typeof import('./provoli-karta.js').sxedioEpiplou>>} s
   */
  function zografiseEpiplo(s) {
    katharise();
    const ola = s.kommatia.flatMap((k) => k.korifes);
    const min = [0, 1, 2].map((i) => Math.min(...ola.map((p) => p[i]))), max = [0, 1, 2].map((i) => Math.max(...ola.map((p) => p[i])));
    const m = min.map((v, i) => (v + max[i]) / 2);
    // SketchUp (x, y, z πάνω) → three (x, y πάνω, z): το μπροστά του επίπλου (−y) προς την κάμερα (+z)
    const simeio = (/** @type {number[]} */ p) => new THREE.Vector3((p[0] - m[0]) * S, (p[2] - m[2]) * S, -(p[1] - m[1]) * S);
    const axno = new THREE.MeshStandardMaterial({ color: XROMA_AXNOU, roughness: 0.8, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const fos = new THREE.MeshStandardMaterial({ color: XROMA_FOTISMENOU, emissive: 0x6A3000, roughness: 0.55, side: THREE.DoubleSide });
    const grammiAxni = new THREE.LineBasicMaterial({ color: 0x5C6865, transparent: true, opacity: 0.35, depthWrite: false });
    for (const k of s.kommatia) {
      const g = geometriaKoutiou(k.korifes.map(simeio));
      const mesh = new THREE.Mesh(g, k.fotismeno ? fos : axno);
      // τα αχνά μετά το φωτεινό, ώστε να μη το σβήνουν
      mesh.renderOrder = k.fotismeno ? 0 : 1;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), k.fotismeno ? lineMat : grammiAxni));
      group.add(mesh);
    }
    // από μπροστά, δεξιά και λίγο από πάνω, όπως το αξονομετρικό του Φύλλου Ομάδας
    katefthynsi = new THREE.Vector3(0.55, 0.6, 0.95).normalize();
    kadro();
  }

  let katefthynsi = new THREE.Vector3(0.55, 0.7, 0.95).normalize();
  function kadro() {
    resize();
    const oria = new THREE.Box3().setFromObject(group);
    if (oria.isEmpty()) return;
    const sfaira = oria.getBoundingSphere(new THREE.Sphere());
    const vFov = camera.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    camera.position.copy(sfaira.center).addScaledVector(katefthynsi, sfaira.radius / Math.sin(Math.min(vFov, hFov) / 2) * 1.05);
    controls.target.copy(sfaira.center);
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
    /** Η γωνία γύρω από τον κατακόρυφο άξονα και η απόσταση της κάμερας από το κέντρο. */
    kamera: () => ({ gonia: controls.getAzimuthalAngle(), apostasi: camera.position.distanceTo(controls.target) }),
  };
}
