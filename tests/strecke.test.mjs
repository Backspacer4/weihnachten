import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logikLaden } from './harness.mjs';

const L = logikLaden();
const strecke = L.buildRoute();

test('die Strecke ist bei jedem Aufruf dieselbe', () => {
  assert.deepEqual(L.buildRoute(), L.buildRoute());
});

test('die Strecke enthaelt genau 50 Geschenke', () => {
  assert.equal(strecke.gifts.length, L.GIFT_TOTAL);
});

test('alle Hindernisse und Geschenke liegen im Streckenverlauf', () => {
  const ende = L.sAtTime(L.TOTAL_SECONDS);
  for (const o of strecke.obstacles) {
    assert.ok(o.s > 0 && o.s < ende, `Hindernis bei s=${o.s} liegt ausserhalb von 0..${ende}`);
  }
  for (const g of strecke.gifts) {
    assert.ok(g.s > 0 && g.s < ende, `Geschenk bei s=${g.s} liegt ausserhalb von 0..${ende}`);
  }
});

test('jede Luecke ist mindestens 3,2 Kuhhoehen hoch', () => {
  for (const o of strecke.obstacles) {
    assert.ok(o.h <= L.MAX_OBSTACLE_H,
      `Hindernis bei s=${o.s} ist ${o.h} hoch, erlaubt sind ${L.MAX_OBSTACLE_H}`);
    assert.ok(L.FIELD.groundY - o.h >= L.MIN_GAP,
      `Luecke bei s=${o.s} ist nur ${L.FIELD.groundY - o.h} hoch`);
  }
});

test('es steht immer nur ein Hindernis im Weg', () => {
  const sortiert = [...strecke.obstacles].sort((a, b) => a.s - b.s);
  for (let i = 1; i < sortiert.length; i++) {
    const links = sortiert[i - 1];
    const rechts = sortiert[i];
    const abstand = (rechts.s - rechts.w / 2) - (links.s + links.w / 2);
    assert.ok(abstand > 0,
      `Hindernisse bei s=${links.s} und s=${rechts.s} ueberlappen (${abstand})`);
  }
});

test('zwischen zwei Hindernissen bleibt Zeit zum Hoehenwechsel', () => {
  const sortiert = [...strecke.obstacles].sort((a, b) => a.ta - b.ta);
  for (let i = 1; i < sortiert.length; i++) {
    const luecke = sortiert[i].ta - sortiert[i - 1].ta;
    assert.ok(luecke >= 1.3, `Nur ${luecke.toFixed(2)} s zwischen zwei Hindernissen bei ${sortiert[i].ta}`);
  }
});

test('an den Etappengrenzen ist die Strecke drei Sekunden frei', () => {
  for (let k = 1; k < L.STAGES.length; k++) {
    const grenze = k * L.STAGE_SECONDS;
    const stoerer = strecke.obstacles.filter(
      (o) => o.ta >= grenze && o.ta <= grenze + L.CLEAR_SPAN);
    assert.equal(stoerer.length, 0,
      `Bei Etappengrenze ${grenze} s stehen ${stoerer.length} Hindernisse im Weg`);
  }
});

test('kein Geschenk liegt in einem Hindernis', () => {
  for (const g of strecke.gifts) {
    for (const o of strecke.obstacles) {
      const inX = Math.abs(g.s - o.s) < o.w / 2 + L.GIFT_R;
      if (!inX) continue;
      const inY = o.from === 'boden'
        ? g.y + L.GIFT_R > L.FIELD.groundY - o.h
        : g.y - L.GIFT_R < o.h;
      assert.ok(!inY, `Geschenk bei s=${g.s}, y=${g.y} steckt im Hindernis bei s=${o.s}`);
    }
  }
});

test('jedes Geschenk ist erreichbar', () => {
  for (const g of strecke.gifts) {
    assert.ok(g.y >= L.COW.h / 2 && g.y <= L.FIELD.groundY - L.COW.h / 2,
      `Geschenk bei s=${g.s} liegt auf y=${g.y} und damit ausserhalb des Flugraums`);
  }
});

test('die Geschenke verteilen sich ueber alle vier Etappen', () => {
  const jeEtappe = [0, 0, 0, 0];
  for (const g of strecke.gifts) jeEtappe[g.stage] += 1;
  jeEtappe.forEach((anzahl, i) => {
    assert.ok(anzahl >= 8, `Etappe ${L.STAGES[i].name} hat nur ${anzahl} Geschenke`);
  });
});

test('die Hindernisse werden abwechselnd vom Boden und von der Decke gesetzt', () => {
  const arten = new Set(strecke.obstacles.map((o) => o.from));
  assert.deepEqual([...arten].sort(), ['boden', 'decke']);
});

/**
 * Weg, den Muhdolf in der Zeit T aus dem Stand hoechstens zuruecklegen kann.
 * Steigen ist die langsamere Richtung (Auftrieb minus Schwerkraft), darum
 * rechnet die Schranke damit -- wer sie besteht, schafft es in beide Richtungen.
 */
function hub(T) {
  const a = L.PHYS.lift - L.PHYS.gravity;
  const v = L.PHYS.maxRise;
  const tv = v / a;
  return T <= tv ? 0.5 * a * T * T : v * T - (v * v) / (2 * a);
}

test('jedes Geschenk hat eine Ankunftszeit', () => {
  for (const g of strecke.gifts) {
    assert.equal(typeof g.ta, 'number', `Geschenk bei s=${g.s} hat kein ta`);
    assert.ok(g.ta > 0 && g.ta < L.TOTAL_SECONDS, `ta=${g.ta} liegt ausserhalb des Fluges`);
  }
});

test('aufeinanderfolgende Geschenke sind nacheinander erreichbar', () => {
  // Die Toleranz beim Einsammeln: Geschenkradius plus halbe Trefferhoehe.
  const tol = L.GIFT_R + (L.COW.h * L.HIT_SHRINK) / 2;
  const sortiert = [...strecke.gifts].sort((a, b) => a.s - b.s);
  for (let i = 1; i < sortiert.length; i++) {
    const a = sortiert[i - 1];
    const b = sortiert[i];
    const T = (b.s - a.s) / L.rateFor(b.stage);
    const noetig = Math.max(0, Math.abs(b.y - a.y) - 2 * tol);
    assert.ok(noetig <= hub(T) + 1e-9,
      `Von s=${a.s} (y=${a.y}) nach s=${b.s} (y=${b.y}): ${noetig.toFixed(1)} Einheiten ` +
      `in ${T.toFixed(3)} s noetig, moeglich sind nur ${hub(T).toFixed(1)}`);
  }
});

test('zwischen zwei Hindernissen ist der noetige Hoehenwechsel fliegbar', () => {
  const sortiert = [...strecke.obstacles].sort((a, b) => a.s - b.s);
  for (let i = 1; i < sortiert.length; i++) {
    const a = sortiert[i - 1];
    const b = sortiert[i];
    // Mitte der jeweils freien Luecke -- dort fliegt ein vernuenftiger Spieler
    const mitteVon = (o) => o.from === 'boden'
      ? (L.FIELD.groundY - o.h) / 2
      : o.h + (L.FIELD.groundY - o.h) / 2;
    const T = (b.s - a.s) / L.rateFor(b.stage);
    const noetig = Math.abs(mitteVon(b) - mitteVon(a));
    assert.ok(noetig <= hub(T) + 1e-9,
      `Von Hindernis s=${a.s} nach s=${b.s}: ${noetig.toFixed(1)} Einheiten ` +
      `in ${T.toFixed(3)} s noetig, moeglich sind nur ${hub(T).toFixed(1)}`);
  }
});

test('an den Etappengrenzen liegen auch keine Geschenke', () => {
  for (let k = 1; k < L.STAGES.length; k++) {
    const grenze = k * L.STAGE_SECONDS;
    const stoerer = strecke.gifts.filter((g) => g.ta >= grenze && g.ta <= grenze + L.CLEAR_SPAN);
    assert.equal(stoerer.length, 0,
      `Bei Etappengrenze ${grenze} s liegen ${stoerer.length} Geschenke hinter der Einblendung`);
  }
});

test('riskante Geschenke liegen naeher am Hindernis als bequeme', () => {
  const abstandZumHindernis = (g) => {
    let nah = Infinity;
    for (const o of strecke.obstacles) {
      if (Math.abs(o.s - g.s) > o.w / 2 + L.GIFT_R + 40) continue;
      const kante = o.from === 'boden' ? L.FIELD.groundY - o.h : o.h;
      nah = Math.min(nah, Math.abs(g.y - kante));
    }
    return nah;
  };
  const je = (k) => strecke.gifts.filter((g) => g.klasse === k)
    .map(abstandZumHindernis).filter((d) => Number.isFinite(d));
  const riskant = je('riskant');
  assert.ok(riskant.length >= 10, `nur ${riskant.length} riskante Geschenke an einem Hindernis`);
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  assert.ok(median(riskant) <= 45,
    `Median-Abstand der riskanten Geschenke ist ${median(riskant)} -- das ist kein Risiko`);
});

/**
 * Warum es diesen Test gibt: Ohne ihn kann eine Aenderung an `SEED`, an
 * `obstacleRange` oder am Hindernisabstand eine Stelle erzeugen, an der ein
 * Geschenk nur um den Preis eines Herzens zu holen ist. Es liegt dann dicht
 * vor einem Hindernis auf einer Hoehe, die im Hoehenband dieses Hindernisses
 * liegt -- wer es nimmt, hat bis zur Vorderkante nicht mehr genug Strecke, um
 * auszuweichen, und verliert zwangslaeufig ein Herz.
 *
 * Die beiden vorhandenen Erreichbarkeitstests sehen das nicht: der eine prueft
 * nur den Uebergang von Geschenk zu Geschenk, der andere nur den von Hindernis
 * zu Hindernis. Erst die Kombination Geschenk -> naechstes Hindernis deckt die
 * Luecke ab.
 */
test('jedes Geschenk ist ohne Herzverlust vor dem naechsten Hindernis zu holen', () => {
  // Einsammel-Toleranz senkrecht: Geschenkradius plus halbe Trefferhoehe. Wer
  // das Geschenk am oberen bzw. unteren Rand dieser Toleranz nimmt, hat
  // entsprechend weniger Weg vor sich -- das rechnen wir dem Spieler an, aber
  // nicht mehr als das.
  const tol = L.GIFT_R + (L.COW.h * L.HIT_SHRINK) / 2;
  const halbeKuh = (L.COW.h * L.HIT_SHRINK) / 2;
  const sortiert = [...strecke.obstacles].sort((a, b) => a.s - b.s);

  for (const g of strecke.gifts) {
    // Das naechste Hindernis dahinter: das erste, dessen Vorderkante jenseits
    // des Geschenks liegt. Ein Reichweitenfilter braucht es nicht -- liegt das
    // Hindernis weit weg, ist hub(T) groesser als das Feld und die Pruefung
    // geht von selbst durch.
    const o = sortiert.find((x) => x.s - x.w / 2 > g.s);
    if (!o) continue;
    const T = (o.s - o.w / 2 - g.s) / L.rateFor(o.stage);
    // Hoehe, die Muhdolf an der Vorderkante haben MUSS, um nicht zu treffen.
    const grenze = o.from === 'boden'
      ? L.FIELD.groundY - o.h * L.HIT_SHRINK - halbeKuh
      : o.h * L.HIT_SHRINK + halbeKuh;
    // Guenstigster Einsammelpunkt: vor einem Bodenhindernis muss sie nach oben,
    // also nimmt sie das Geschenk am oberen Rand der Toleranz mit; vor einem
    // Deckenhindernis umgekehrt.
    const start = o.from === 'boden' ? g.y - tol : g.y + tol;
    const noetig = o.from === 'boden'
      ? Math.max(0, start - grenze)
      : Math.max(0, grenze - start);
    assert.ok(noetig <= hub(T) + 1e-9,
      `Geschenk bei s=${g.s.toFixed(1)} auf y=${g.y} vor dem ` +
      `${o.from === 'boden' ? 'Boden' : 'Decken'}hindernis ${o.kind} bei s=${o.s.toFixed(1)} ` +
      `(h=${o.h}, Vorderkante s=${(o.s - o.w / 2).toFixed(1)}): noetig sind ` +
      `${noetig.toFixed(1)} Einheiten Hoehenwechsel in ${T.toFixed(3)} s, ` +
      `moeglich sind nur ${hub(T).toFixed(1)}`);
  }
});
