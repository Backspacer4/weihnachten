import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logikLaden } from './harness.mjs';

const L = logikLaden();

test('die volle Punktzahl ergibt genau 5200', () => {
  const p = L.SCORE;
  const summe = p.perSecond * L.TOTAL_SECONDS
    + p.perGift * L.GIFT_TOTAL
    + p.finish
    + p.perHeart * L.HEARTS
    + p.allGifts;
  assert.equal(summe, p.max, 'Die Einzelposten muessen die ausgewiesene Obergrenze ergeben');
  assert.equal(p.max, 5200);
});

test('die Mindestluecke ist 3,2 Kuhhoehen hoch', () => {
  assert.equal(L.MIN_GAP, 3.2 * L.COW.h);
});

test('jede Etappe laesst eine passierbare Luecke zu', () => {
  // Das hoechstmoegliche Hindernis muss die Mindestluecke uebrig lassen.
  assert.ok(L.FIELD.groundY - L.MIN_GAP > 0);
  assert.equal(L.MAX_OBSTACLE_H, L.FIELD.groundY - L.MIN_GAP);
});

test('die vier Etappen ergeben zusammen die Gesamtdauer', () => {
  assert.equal(L.STAGES.length * L.STAGE_SECONDS, L.TOTAL_SECONDS);
});

test('die Scrollgeschwindigkeit folgt aus der Querungszeit', () => {
  const weg = L.FIELD.w - L.COW.x;
  L.STAGES.forEach((etappe, i) => {
    assert.ok(Math.abs(L.rateFor(i) - weg / etappe.crossing) < 0.001,
      `Etappe ${etappe.name}: ${L.rateFor(i)} passt nicht zu ${etappe.crossing} s`);
  });
});
