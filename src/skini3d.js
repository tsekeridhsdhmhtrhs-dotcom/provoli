// Ζωγραφική μιας Σκηνής (src/core/syndesmos.js): κουτάκια με θέση, χρώμα, explode και πόρτες που ανοίγουν.
// Δεν φορτώνει τίποτα από τον πυρήνα του εργαλείου και δεν υπολογίζει τίποτα· μόνο ζωγραφίζει ό,τι της δίνουν. Γι' αυτό
// μπορεί να βρίσκεται σε δημόσιες σελίδες: την Προβολή του QR και τη σελίδα του server (ADR 0018).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const S = 0.001; // mm → m
const XROMATA = { kormos: 0xE8E5DE, xorisma: 0xE2DFD7, rafi: 0xDCD8CF, kinito: 0xEFEBE3, plati: 0xB7AD9B, podia: 0x2E3331, porta: 0xF2EFE8, fatsa: 0xE8E5DE, syrtaria: 0xDCD8CF, syrtari: 0x4A4541, legrabox: 0x9AA1A5, gyali: 0xBFDDE0, alouminio: 0x9AA1A5 };
const EPILOGI = 0x13A3AD;
const METALLO = new Set(['legrabox', 'alouminio']);
const GONIA_ANOIGMATOS = 100 * Math.PI / 180;
const GONIA_EXPLODE = 90 * Math.PI / 180;
const omala = (u) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };

function xromaEidous(eidos, c) {
  const [kormos, metopa, plati, esoteriko] = c ?? [];
  const apoKatalogo = { kormos, porta: metopa, fatsa: metopa, plati, rafi: esoteriko, kinito: esoteriko, xorisma: esoteriko }[eidos];
  return apoKatalogo ?? XROMATA[eidos] ?? XROMATA.kormos;
}

/**
 * Ένα 3D μέσα στο el. zografise(skini, kommatiId, anoixtes): ζωγραφίζει τη Σκηνή με το κομμάτι φωτισμένο και τις
 * πόρτες ανοιχτές ή κλειστές. explode(f): 0 συναρμολογημένο, 1 όλα ανοιχτά.
 * @param {HTMLElement} el
 */
export function neaSkini3d(el) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.dampingFactor = 0.12;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a908d, 1.6));
  const d1 = new THREE.DirectionalLight(0xffffff, 1.6); d1.position.set(2.5, 4, 3.5); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.6); d2.position.set(-3, 2, -2); scene.add(d2);
  const grid = new THREE.GridHelper(8, 40, 0x8c9693, 0x8c9693);
  grid.material.transparent = true; grid.material.opacity = 0.25;
  scene.add(grid);
  const group = new THREE.Group();
  scene.add(group);
  const KATEFTHYNSI = new THREE.Vector3(0.55, 0.22, 0.95).normalize();
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3A403E, transparent: true, opacity: 0.85 });

  /** @type {{ obj: THREE.Object3D, base: THREE.Vector3, ex: number[] }[]} */
  let kommatia = [];
  /** @type {{ pivot: THREE.Group, fora: number }[]} */
  let portes = [];
  let anoixtes = false, explode = 0;

  function katharise() {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== lineMat) o.material.dispose(); });
    group.clear();
    kommatia = []; portes = [];
  }

  function efarmoseThesi() {
    const k = omala(explode);
    for (const { obj, base, ex } of kommatia) obj.position.set(base.x + ex[0] * k * S, base.y + ex[1] * k * S, base.z + ex[2] * k * S);
    for (const { pivot, fora } of portes) pivot.rotation.y = -fora * (anoixtes ? GONIA_ANOIGMATOS : omala(explode) * GONIA_EXPLODE);
  }

  /** Η κάμερα χωράει όλα τα κομμάτια όπως είναι τώρα. idiaMeria: από την πλευρά που κοιτάει τώρα, αλλιώς λοξά μπροστά. */
  function kadro(idiaMeria = false) {
    resize();
    const oria = new THREE.Box3().setFromObject(group);
    if (oria.isEmpty()) return;
    const sfaira = oria.getBoundingSphere(new THREE.Sphere());
    const vFov = camera.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const pros = idiaMeria ? camera.position.clone().sub(controls.target).normalize() : KATEFTHYNSI;
    camera.position.copy(sfaira.center).addScaledVector(pros, sfaira.radius / Math.sin(Math.min(vFov, hFov) / 2) * 1.05);
    controls.target.copy(sfaira.center);
    controls.update();
  }

  function zografise(skini, kommatiId = '', meAnoixtes = false) {
    katharise();
    anoixtes = meAnoixtes;
    for (const [id, eidos, x, y, z, dx, dy, dz, ex, ey, ez, pleura] of skini.p) {
      const g = new THREE.BoxGeometry(dx * S, dy * S, dz * S);
      const yliko = new THREE.MeshStandardMaterial({
        color: id === kommatiId ? EPILOGI : xromaEidous(eidos, skini.c), roughness: METALLO.has(eidos) ? 0.35 : 0.75, metalness: METALLO.has(eidos) ? 0.6 : 0,
        transparent: eidos === 'gyali', opacity: eidos === 'gyali' ? 0.35 : 1,
      });
      const mesh = new THREE.Mesh(g, yliko);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), lineMat));
      let obj = mesh;
      if (pleura === 1 || pleura === -1) {
        // πόρτα: γυρίζει γύρω από την άκρη των μεντεσέδων
        const pivot = new THREE.Group();
        pivot.position.set((pleura === 1 ? x : x + dx) * S, (y + dy / 2) * S, z * S);
        mesh.position.set(pleura * dx / 2 * S, 0, dz / 2 * S);
        pivot.add(mesh);
        portes.push({ pivot, fora: pleura });
        obj = pivot;
      } else {
        mesh.position.set((x + dx / 2) * S, (y + dy / 2) * S, (z + dz / 2) * S);
      }
      group.add(obj);
      kommatia.push({ obj, base: obj.position.clone(), ex: [ex, ey, ez] });
    }
    if (skini.h > 0) {
      const g = new THREE.CylinderGeometry(skini.r * S, skini.r * S, skini.h * S, 20);
      const yliko = new THREE.MeshStandardMaterial({ color: XROMATA.podia, roughness: 0.75 });
      const ex = skini.fe ?? [0, 0, 0];
      for (const [x, z] of skini.f) {
        const m = new THREE.Mesh(g, yliko);
        m.position.set(x * S, skini.h / 2 * S, z * S);
        group.add(m);
        kommatia.push({ obj: m, base: m.position.clone(), ex });
      }
    }
    efarmoseThesi();
    kadro();
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
    /** @param {number} f */
    explode(f) { explode = f; efarmoseThesi(); },
    /** Η κάμερα ξαναχωράει τα κομμάτια (π.χ. όταν αφήνεις τη μπάρα του Ανοίγματος), από την ίδια πλευρά. */
    kadro() { kadro(true); },
  };
}
