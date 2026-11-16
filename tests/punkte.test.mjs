import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logikLaden } from './harness.mjs';

const L = logikLaden();

test('ein Geschenk im Weg wird eingesammelt', () => {
  const g = { s: L.COW.x, y: 270 };
  const z = L.createState({ obstacles: [], gifts: [g] });
  z.cowY = 270;
  L.step(z, false, L.STEP);
  assert.equal(z.giftsTaken, 1);
  assert.equal(z.gifts[0].taken, true);
});

test('ein Geschenk zaehlt nur einmal', () => {
  const z = L.createState({ obstacles: [], gifts: [{ s: L.COW.x, y: 270 }] });
  for (let i = 0; i < 10; i++) {
    z.cowY = 270;
    L.step(z, false, L.STEP);
  }
  assert.equal(z.giftsTaken, 1);
});

test('ein Geschenk abseits der Flugbahn bleibt liegen', () => {
  const z = L.createState({ obstacles: [], gifts: [{ s: L.COW.x, y: 120 }] });
  z.cowY = 400;
  L.step(z, false, L.STEP);
  assert.equal(z.giftsTaken, 0);
});

test('ein Geschenk bringt 50 Punkte', () => {
  const z = L.createState({ obstacles: [], gifts: [{ s: L.COW.x, y: 270 }] });
  z.cowY = 270;
  L.step(z, false, L.STEP);
  assert.equal(z.score, L.SCORE.perGift + Math.floor(L.STEP * L.SCORE.perSecond));
});

test('eine perfekte Runde ergibt genau 5200 Punkte', () => {
  const z = L.createState({ obstacles: [], gifts: [] });
  z.phase = 'ziel';
  z.t = L.TOTAL_SECONDS;
  z.giftsTaken = L.GIFT_TOTAL;
  z.hearts = L.HEARTS;
  assert.equal(L.scoreOf(z), 5200);
  assert.equal(L.scoreOf(z), L.SCORE.max);
});

test('niemand kommt ueber die Obergrenze', () => {
  const z = L.createState({ obstacles: [], gifts: [] });
  z.phase = 'ziel';
  z.t = L.TOTAL_SECONDS + 5;          // laengere Flugzeit darf nichts bringen
  z.giftsTaken = L.GIFT_TOTAL;
  z.hearts = L.HEARTS;
  assert.equal(L.scoreOf(z), L.SCORE.max);
});

test('wer nur durchkommt, liegt deutlich unter der Obergrenze', () => {
  const z = L.createState({ obstacles: [], gifts: [] });
  z.phase = 'ziel';
  z.t = L.TOTAL_SECONDS;
  z.giftsTaken = 20;
  z.hearts = 2;
  const punkte = L.scoreOf(z);
  assert.ok(punkte > 2000 && punkte < 3500, `Durchkommen ergab ${punkte} Punkte`);
});

test('der Bonus fuer alle Geschenke faellt bei 49 Stueck weg', () => {
  const basis = L.createState({ obstacles: [], gifts: [] });
  basis.phase = 'ziel';
  basis.t = L.TOTAL_SECONDS;
  basis.hearts = L.HEARTS;
  basis.giftsTaken = 49;
  const mit50 = { ...basis, giftsTaken: 50 };
  assert.equal(L.scoreOf(mit50) - L.scoreOf(basis), L.SCORE.perGift + L.SCORE.allGifts);
});

test('vor dem Ziel gibt es keinen Zielbonus', () => {
  const z = L.createState({ obstacles: [], gifts: [] });
  z.t = 100;
  z.giftsTaken = 30;
  assert.equal(L.scoreOf(z), 1000 + 30 * L.SCORE.perGift);
});
