// Το κομμάτι της κάρτας σε 3D (#346): ένα ορθογώνιο κομμάτι με φάλτσο και PVC, από το σχέδιο της provoli-karta.js
// (sxedioKommatiou). Περιστροφή με ένα δάχτυλο, pinch-zoom με δύο (OrbitControls). Δεν φορτώνει τίποτα από τον πυρήνα και
// δεν υπολογίζει διαστάσεις· μόνο ζωγραφίζει ό,τι της δίνουν (ADR 0018). Τρύπες και κινησιά δεν ζωγραφίζονται: δεν υπάρχουν
// ως σχήμα στο URL της κάρτας και δεν προστίθενται στο QR (ADR 0047).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mesaioPan } from './pan3d.js';
import { meriaKameras } from './provoli-karta.js';

const S = 0.001; // mm → m
const XROMA_KORMOU = 0xE2DFD7;
const XROMA_PVC = 0xC8372D; // το ίδιο κόκκινο με το Σημάδι PVC του SketchUp
// τα 6 ζεύγη τριγώνων των όψεων του «κουτιού» με κάτω 0–3 και πάνω 4–7 (προς τα έξω)
const TRIGONA = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];

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
    // δύο τρίγωνα ανά όψη, χωρίς κοινές κορυφές, για επίπεδη σκίαση
    const pos = [];
    for (const [a, b, c, d] of TRIGONA) for (const i of [a, b, c, a, c, d]) pos.push(k[i].x, k[i].y, k[i].z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
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
    kadro,
    /** Η γωνία γύρω από τον κατακόρυφο άξονα και η απόσταση της κάμερας από το κέντρο. */
    kamera: () => ({ gonia: controls.getAzimuthalAngle(), apostasi: camera.position.distanceTo(controls.target) }),
  };
}
