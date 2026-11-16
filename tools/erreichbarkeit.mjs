// Beweist, dass die volle Punktzahl von 5200 auf der Strecke erreichbar ist.
//
//   node tools/erreichbarkeit.mjs            (Strahlbreite 1200, dauert ~20 s)
//   node tools/erreichbarkeit.mjs 2400       (breiter, langsamer, findet mehr)
//
// WANN LAUFEN LASSEN: nach jeder Aenderung an SEED, obstacleRange, dem
// Hindernisabstand, GIFT_SPACING oder der Flugphysik. Die Testsuite prueft
// einzelne Eigenschaften der Strecke; nur diese Suche beantwortet die Frage,
// ob eine einzige Runde tatsaechlich alle 50 Geschenke ohne Treffer holen
// kann. Steht auf dem Endbildschirm "von 5200", muss diese Zahl stimmen.
//
// Das Verfahren: eine Vorwaerts-Beam-Suche ueber die echte Strecke, die jeden
// Schritt mit der echten GameLogic.step-Physik rechnet. Jeder Treffer und
// jedes verpasste Geschenk fuehrt zum Verwerfen des Zustands. Am Ende wird die
// gefundene Eingabefolge auf einer frischen Runde nachgespielt -- erst das ist
// der Nachweis, denn damit prueft die Suche nicht ihr eigenes Modell.
import { logikLaden } from '../tests/harness.mjs';

const L = logikLaden();

// Die Geschenk-Verwaltung unten fuehrt zwei 25-Bit-Masken mit. Mehr als 50
// Geschenke wuerden stillschweigend falsch gezaehlt, darum hier die Bremse.
if (L.GIFT_TOTAL > 50) {
  throw new Error(`Diese Suche traegt hoechstens 50 Geschenke, GIFT_TOTAL ist ${L.GIFT_TOTAL}`);
}

const W = Number(process.argv[2] || 1200);      // Strahlbreite
const DT = L.STEP;
const N = Math.round(L.TOTAL_SECONDS / DT);     // 16800 Schritte
const strecke = L.buildRoute();
const gifts = strecke.gifts;
const obstacles = strecke.obstacles;
console.log(`Strecke: ${obstacles.length} Hindernisse, ${gifts.length} Geschenke, ${N} Schritte, Strahlbreite ${W}`);

// --- Referenzzustand: t, s und stage kommen aus L.step selbst -------------
// Leere Strecke und gehaltener Auftrieb: so laeuft er garantiert bis zum Ziel
// durch. s haengt nicht von der Eingabe ab (s += rateFor(stage) * dt), die
// Werte sind also genau die des echten Fluges -- anders als sAtTime(t), das
// stueckweise exakt integriert statt Schritt fuer Schritt zu akkumulieren.
const sVor = new Float64Array(N), sNach = new Float64Array(N);
const tVor = new Float64Array(N), stageVor = new Int32Array(N);
{
  const ref = L.createState({ obstacles: [], gifts: [] });
  for (let i = 0; i < N; i++) {
    tVor[i] = ref.t; sVor[i] = ref.s; stageVor[i] = ref.stage;
    L.step(ref, true, DT);
    sNach[i] = ref.s;
  }
  console.log(`Referenz am Ende: phase=${ref.phase} t=${ref.t} s=${ref.s.toFixed(2)} stage=${ref.stage}`);
  console.log(`Abweichung Referenz-s gegen sAtTime(140): ${Math.abs(ref.s - L.sAtTime(L.TOTAL_SECONDS)).toFixed(2)} Einheiten`);
}

// --- Kandidaten je Schritt (genau die, die step durchlaesst) --------------
const HW_GIFT = L.GIFT_R + L.COW.w;
const oIdx = [], gIdx = [], passiert = new Int32Array(N);
const obsSort = [...obstacles].sort((a, b) => a.s - b.s);
const gSort = [...gifts].sort((a, b) => a.s - b.s);
const xTol = L.GIFT_R + (L.COW.w * L.HIT_SHRINK) / 2;   // ab hier ist ein Geschenk verloren
for (let i = 0; i < N; i++) {
  const mitte = sNach[i] + L.COW.x;
  oIdx.push(obsSort.filter((o) => Math.abs(o.s - mitte) <= o.w / 2 + L.COW.w));
  gIdx.push(gSort.map((g, k) => [g, k]).filter((p) => Math.abs(p[0].s - mitte) <= HW_GIFT));
  let n = 0;
  for (const g of gSort) if (mitte - g.s >= xTol) n++;
  passiert[i] = n;
}
console.log(`Geschenke, die am Ende passiert sein muessen: ${passiert[N - 1]}`);

// --- Beam-Suche -----------------------------------------------------------
const eltern = new Int32Array(N * W);
const bits = new Uint8Array(N * W);
const cY = new Float64Array(W), cV = new Float64Array(W);
const cLo = new Int32Array(W), cHi = new Int32Array(W), cT = new Int32Array(W);
let anzahl = 1;
{ const z0 = L.createState({ obstacles: [], gifts: [] }); cY[0] = z0.cowY; cV[0] = z0.vy; }

const scratch = {
  phase: 'fliegt', t: 0, s: 0, cowY: 0, vy: 0, hearts: L.HEARTS, invuln: 0,
  giftsTaken: 0, stage: 0, bannerLeft: 0, obstacles: [], gifts: [], score: 0,
};
const M = W * 2;
const nY = new Float64Array(M), nV = new Float64Array(M), nLo = new Int32Array(M);
const nHi = new Int32Array(M), nT = new Int32Array(M), nP = new Int32Array(M), nB = new Uint8Array(M);

const zielY = new Float64Array(N);               // Hoehe des naechsten offenen Geschenks
{
  let k = 0;
  for (let i = 0; i < N; i++) {
    while (k < gSort.length && sNach[i] + L.COW.x - gSort[k].s >= xTol) k++;
    zielY[i] = k < gSort.length ? gSort[k].y : L.FIELD.h / 2;
  }
}

const start = Date.now();
for (let i = 0; i < N; i++) {
  const gk = gIdx[i], ok = oIdx[i];
  const kandGifts = gk.map((p) => ({ s: p[0].s, y: p[0].y, taken: false }));
  let m = 0;
  const raster = new Map();
  for (let j = 0; j < anzahl; j++) {
    for (let b = 0; b < 2; b++) {
      scratch.phase = 'fliegt'; scratch.hearts = L.HEARTS; scratch.invuln = 0; scratch.bannerLeft = 0;
      scratch.t = tVor[i]; scratch.s = sVor[i]; scratch.stage = stageVor[i];
      scratch.cowY = cY[j]; scratch.vy = cV[j];
      scratch.giftsTaken = cT[j]; scratch.obstacles = ok; scratch.gifts = kandGifts;
      let lo = cLo[j], hi = cHi[j];
      for (let q = 0; q < gk.length; q++) {
        const k = gk[q][1];
        kandGifts[q].taken = k < 25 ? ((lo >>> k) & 1) === 1 : ((hi >>> (k - 25)) & 1) === 1;
      }
      L.step(scratch, b === 1, DT);
      if (scratch.hearts !== L.HEARTS) continue;              // jeder Treffer ist das Aus
      for (let q = 0; q < gk.length; q++) {
        if (!kandGifts[q].taken) continue;
        const k = gk[q][1];
        if (k < 25) lo |= 1 << k; else hi |= 1 << (k - 25);
      }
      if (scratch.giftsTaken < passiert[i]) continue;          // ein Geschenk verpasst
      // Rasterung: eine Lage je Zelle, die mit den meisten Geschenken gewinnt
      const schl = `${Math.round(scratch.cowY / 2.5)}|${Math.round(scratch.vy / 25)}|${lo}|${hi}`;
      const alt = raster.get(schl);
      if (alt !== undefined && nT[alt] >= scratch.giftsTaken) continue;
      const slot = alt !== undefined ? alt : m++;
      if (alt === undefined) raster.set(schl, slot);
      nY[slot] = scratch.cowY; nV[slot] = scratch.vy; nLo[slot] = lo; nHi[slot] = hi;
      nT[slot] = scratch.giftsTaken; nP[slot] = j; nB[slot] = b;
    }
  }
  if (m === 0) {
    console.log(`ABBRUCH bei Schritt ${i} (t=${tVor[i].toFixed(2)} s): kein Zustand ueberlebt`);
    process.exit(1);
  }
  let order = Array.from({ length: m }, (_, x) => x);
  if (m > W) {
    const zy = zielY[i];
    order.sort((a, c) => (nT[c] - nT[a]) || (Math.abs(nY[a] - zy) - Math.abs(nY[c] - zy)));
    order = order.slice(0, W);
  }
  for (let x = 0; x < order.length; x++) {
    const o = order[x];
    cY[x] = nY[o]; cV[x] = nV[o]; cLo[x] = nLo[o]; cHi[x] = nHi[o]; cT[x] = nT[o];
    eltern[i * W + x] = nP[o]; bits[i * W + x] = nB[o];
  }
  anzahl = order.length;
  if (i % 2400 === 0) {
    let best = 0;
    for (let x = 0; x < anzahl; x++) best = Math.max(best, cT[x]);
    console.log(`  Schritt ${i} (t=${tVor[i].toFixed(1)} s): ${anzahl} Zustaende, beste ${best} Geschenke, ${passiert[i]} passiert`);
  }
}
console.log(`Suche fertig in ${((Date.now() - start) / 1000).toFixed(1)} s`);

let sieger = -1, bestEnde = 0;
for (let j = 0; j < anzahl; j++) {
  bestEnde = Math.max(bestEnde, cT[j]);
  if (cT[j] === L.GIFT_TOTAL && sieger < 0) sieger = j;
}
if (sieger < 0) {
  console.log(`KEINE Loesung: bestes Ergebnis ${bestEnde} von ${L.GIFT_TOTAL} Geschenken`);
  process.exit(1);
}
const folge = new Uint8Array(N);
let j = sieger;
for (let i = N - 1; i >= 0; i--) { folge[i] = bits[i * W + j]; j = eltern[i * W + j]; }
let gehalten = 0;
for (const x of folge) gehalten += x;
console.log(`Eingabefolge gefunden: ${gehalten} von ${N} Schritten mit Auftrieb`);

// --- Nachspielen auf einer frischen Runde --------------------------------
// Erst das ist der Nachweis: die echte Strecke, die echte Physik, von vorn.
const z = L.createState();
for (let i = 0; i < N; i++) L.step(z, folge[i] === 1, DT);
console.log('');
console.log('=== NACHSPIELEN auf einer frischen Runde ===');
console.log(`phase=${z.phase}  Flugzeit=${z.t.toFixed(3)} s  Geschenke=${z.giftsTaken}/${L.GIFT_TOTAL}  ` +
  `Herzen=${z.hearts}/${L.HEARTS}  Punkte=${z.score} von ${L.SCORE.max}`);
const bestanden = z.phase === 'ziel' && z.giftsTaken === L.GIFT_TOTAL
  && z.hearts === L.HEARTS && z.score === L.SCORE.max;
console.log(bestanden
  ? `NACHWEIS ERBRACHT: ${L.SCORE.max} von ${L.SCORE.max} Punkten sind erreichbar.`
  : 'NACHWEIS GESCHEITERT.');
process.exit(bestanden ? 0 : 1);
