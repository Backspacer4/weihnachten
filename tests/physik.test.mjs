import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logikLaden } from './harness.mjs';

const L = logikLaden();

/** Rechnet n Schritte mit gleichbleibender Eingabe. */
function fliegen(zustand, auftrieb, n) {
  for (let i = 0; i < n; i++) L.step(zustand, auftrieb, L.STEP);
  return zustand;
}

test('Muhdolf startet in der Mitte und ruht', () => {
  const z = L.createState();
  assert.equal(z.cowY, L.FIELD.h / 2);
  assert.equal(z.vy, 0);
  assert.equal(z.t, 0);
  assert.equal(z.phase, 'fliegt');
});

test('gehaltene Eingabe laesst sie steigen', () => {
  const z = L.createState();
  const start = z.cowY;
  fliegen(z, true, 60);                       // eine halbe Sekunde
  assert.ok(z.cowY < start, `erwartet < ${start}, war ${z.cowY}`);
});

test('ohne Eingabe sinkt sie', () => {
  const z = L.createState();
  const start = z.cowY;
  fliegen(z, false, 60);
  assert.ok(z.cowY > start, `erwartet > ${start}, war ${z.cowY}`);
});

test('die Sinkgeschwindigkeit ist begrenzt', () => {
  const z = L.createState();
  z.cowY = 60;                                // hoch ansetzen, der Boden kommt in Aufgabe 5
  fliegen(z, false, 100);                     // gut acht Zehntel Sekunden freier Fall
  assert.equal(z.vy, L.PHYS.maxFall, 'Die Grenze muss genau greifen');
});

test('die Steiggeschwindigkeit ist begrenzt', () => {
  const z = L.createState();
  z.cowY = 460;
  fliegen(z, true, 100);
  assert.equal(z.vy, -L.PHYS.maxRise);
});

test('die Decke haelt und nimmt die Geschwindigkeit', () => {
  const z = L.createState();
  fliegen(z, true, 600);
  assert.ok(z.cowY >= L.COW.h / 2 - 1e-9, `cowY war ${z.cowY}`);
  assert.equal(z.vy, 0);
});

test('die Flugzeit und die Streckenposition wachsen', () => {
  const z = L.createState();
  fliegen(z, false, 120);                     // eine Sekunde
  assert.ok(Math.abs(z.t - 1) < 1e-6, `t war ${z.t}`);
  assert.ok(Math.abs(z.s - L.rateFor(0)) < 0.5, `s war ${z.s}`);
});

test('dieselbe Eingabefolge ergibt denselben Zustand', () => {
  const lauf = () => {
    const z = L.createState();
    for (let i = 0; i < 4000; i++) L.step(z, (i >> 5) % 2 === 0, L.STEP);
    return [z.t, z.s, z.cowY, z.vy, z.hearts, z.giftsTaken, z.score, z.phase, z.stage];
  };
  assert.deepEqual(lauf(), lauf());
});
