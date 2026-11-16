import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logikLaden } from './harness.mjs';

const L = logikLaden();

/**
 * Legt einen Zustand mit einem einzigen Hindernis an, das genau vor Muhdolf
 * steht -- so ist jeder Treffer nachvollziehbar und kein Zufall im Spiel.
 */
function mitHindernis({ from = 'boden', h = 300, w = 60, cowY }) {
  const o = { ta: 10, s: L.COW.x, from, kind: 'test', w, h, stage: 0 };
  const z = L.createState({ obstacles: [o], gifts: [] });
  z.cowY = cowY;
  return { z, o };
}

/** Ein einzelner Schritt, bei dem die Hoehe festgehalten wird. */
function einSchritt(z) {
  const y = z.cowY;
  L.step(z, false, L.STEP);
  z.cowY = y;
  z.vy = 0;
  return z;
}

test('ein Treffer kostet ein Herz', () => {
  // Hindernis 300 hoch vom Boden: belegt y von 200 bis 500.
  const { z } = mitHindernis({ h: 300, cowY: 460 });
  einSchritt(z);
  assert.equal(z.hearts, L.HEARTS - 1);
  assert.ok(z.invuln > 0, 'Nach einem Treffer muss die Unverwundbarkeit laufen');
});

test('ein Beinahe-Vorbeiflug kostet nichts', () => {
  // Die Trefferflaechen sind auf 80 % geschrumpft: die Spitze liegt bei y=260.
  const { z } = mitHindernis({ h: 300, cowY: 210 });
  einSchritt(z);
  assert.equal(z.hearts, L.HEARTS);
});

test('ein Hindernis von der Decke trifft oben', () => {
  const { z } = mitHindernis({ from: 'decke', h: 200, cowY: 60 });
  einSchritt(z);
  assert.equal(z.hearts, L.HEARTS - 1);
});

test('nach einem Treffer wird Muhdolf aus dem Hindernis gesetzt', () => {
  // Direkter step-Aufruf statt einSchritt: einSchritt haelt die Hoehe
  // absichtlich fest (siehe sein Kommentar) und wuerde genau die Versetzung
  // rueckgaengig machen, die dieser Test beobachten soll.
  const { z } = mitHindernis({ h: 300, cowY: 460 });
  L.step(z, false, L.STEP);
  assert.ok(z.cowY < L.FIELD.groundY - 300,
    `erwartet oberhalb der Spitze (y < 200), war ${z.cowY}`);
  assert.equal(z.vy, 0, 'Die Fallgeschwindigkeit muss genullt sein');
});

test('waehrend der Unverwundbarkeit kostet ein zweiter Treffer nichts', () => {
  const { z } = mitHindernis({ h: 300, cowY: 460 });
  einSchritt(z);
  const herzen = z.hearts;
  z.cowY = 460;
  for (let i = 0; i < 20; i++) einSchritt(z);
  assert.equal(z.hearts, herzen);
});

test('Bodenkontakt kostet ein Herz', () => {
  const z = L.createState({ obstacles: [], gifts: [] });
  z.cowY = L.FIELD.groundY - L.COW.h / 2 + 1;
  L.step(z, false, L.STEP);
  assert.equal(z.hearts, L.HEARTS - 1);
});

test('der dritte Treffer beendet den Flug', () => {
  const z = L.createState({ obstacles: [], gifts: [] });
  for (let treffer = 1; treffer <= 3; treffer++) {
    z.invuln = 0;
    z.cowY = L.FIELD.groundY - L.COW.h / 2 + 1;
    L.step(z, false, L.STEP);
    assert.equal(z.hearts, L.HEARTS - treffer);
  }
  assert.equal(z.phase, 'abgestuerzt');
});

test('nach dem Absturz wird nicht weitergerechnet', () => {
  const z = L.createState({ obstacles: [], gifts: [] });
  z.hearts = 1;
  z.cowY = L.FIELD.groundY - L.COW.h / 2 + 1;
  L.step(z, false, L.STEP);
  assert.equal(z.phase, 'abgestuerzt');
  const vorher = { t: z.t, s: z.s };
  L.step(z, true, L.STEP);
  assert.deepEqual({ t: z.t, s: z.s }, vorher);
});

test('die Unverwundbarkeit laeuft nach 1,5 Sekunden ab', () => {
  const z = L.createState({ obstacles: [], gifts: [] });
  z.invuln = L.INVULN;
  for (let i = 0; i < Math.round(1.6 / L.STEP); i++) {
    z.cowY = L.FIELD.h / 2;
    L.step(z, true, L.STEP);
  }
  assert.equal(z.invuln, 0);
});

test('ein Absturz im letzten Zeitschritt bleibt ein Absturz', () => {
  const z = L.createState({ obstacles: [], gifts: [] });
  z.t = L.TOTAL_SECONDS - L.STEP / 2;        // Ziel wird in diesem Schritt erreicht
  z.hearts = 1;
  z.cowY = L.FIELD.groundY - L.COW.h / 2 + 1;
  L.step(z, false, L.STEP);
  assert.equal(z.phase, 'abgestuerzt', 'Der dritte Treffer beendet das Spiel, auch auf der Ziellinie');
  assert.equal(z.hearts, 0);
  assert.ok(z.score < L.SCORE.finish + 1400,
    `Kein Zielbonus fuer einen Absturz, Punktzahl war ${z.score}`);
});

test('im Absturzschritt wird kein Geschenk mehr eingesammelt', () => {
  const g = { s: L.COW.x, y: L.FIELD.groundY - L.COW.h / 2 };
  const z = L.createState({ obstacles: [], gifts: [g] });
  z.hearts = 1;
  z.cowY = L.FIELD.groundY - L.COW.h / 2 + 1;
  L.step(z, false, L.STEP);
  assert.equal(z.phase, 'abgestuerzt');
  assert.equal(z.giftsTaken, 0);
});
