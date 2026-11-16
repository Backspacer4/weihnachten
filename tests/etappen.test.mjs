import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logikLaden } from './harness.mjs';

const L = logikLaden();

/** Rechnet bis zur Flugzeit t und gibt den Zustand zurueck. */
function bisZeit(t, auftrieb = false) {
  const z = L.createState({ obstacles: [], gifts: [] });
  const schritte = Math.round(t / L.STEP);
  for (let i = 0; i < schritte; i++) {
    L.step(z, auftrieb, L.STEP);
    z.cowY = L.FIELD.h / 2;                   // Hoehe festhalten, hier zaehlt nur die Zeit
    z.vy = 0;
  }
  return z;
}

test('die erste Etappe ist Bludenz', () => {
  const z = bisZeit(1);
  assert.equal(z.stage, 0);
  assert.equal(L.STAGES[z.stage].name, 'Bludenz');
});

test('die Etappen wechseln alle 35 Sekunden', () => {
  assert.equal(bisZeit(34).stage, 0);
  assert.equal(bisZeit(36).stage, 1);
  assert.equal(bisZeit(71).stage, 2);
  assert.equal(bisZeit(106).stage, 3);
  assert.equal(L.STAGES[bisZeit(106).stage].name, 'Bregenz');
});

test('der Stadtname wird beim Wechsel eingeblendet', () => {
  const z = bisZeit(35.5);
  assert.ok(z.bannerLeft > 0, 'Das Banner muss kurz nach dem Wechsel noch stehen');
  const spaeter = bisZeit(38.5);
  assert.equal(spaeter.bannerLeft, 0, 'Nach zwei Sekunden muss es weg sein');
});

test('nach 140 Sekunden ist Bregenz erreicht', () => {
  const z = bisZeit(140.5);
  assert.equal(z.phase, 'ziel');
  assert.ok(Math.abs(z.t - L.TOTAL_SECONDS) < 1e-9, `t war ${z.t}, erwartet genau 140`);
});

test('im Ziel wird nicht weitergerechnet', () => {
  const z = bisZeit(140.5);
  const vorher = { t: z.t, s: z.s, score: z.score };
  L.step(z, true, L.STEP);
  assert.deepEqual({ t: z.t, s: z.s, score: z.score }, vorher);
});

test('die Flugzeit allein ergibt 1400 Punkte', () => {
  const z = bisZeit(140.5);
  // Ziel (500) und drei Herzen (300) kommen hinzu, Geschenke gab es keine.
  assert.equal(z.score, 1400 + L.SCORE.finish + 3 * L.SCORE.perHeart);
});
