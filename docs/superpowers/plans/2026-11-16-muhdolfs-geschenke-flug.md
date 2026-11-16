# Muhdolfs Geschenke-Flug — Umsetzungsplan

> **Für agentische Worker:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe umzusetzen. Die Schritte benutzen Checkboxen (`- [ ]`) zum Mitführen des Fortschritts.

**Ziel:** Ein Browserspiel als Weihnachtsgruß — Muhdolf, eine Kuh im Rentierkostüm, fliegt von Bludenz nach Bregenz; aufrufbar per QR-Code, spielbar auf Handy und Laptop, mit vergleichbaren Punktzahlen.

**Architektur:** Eine einzige ausgelieferte Datei `index.html`. Darin zwei getrennte Script-Blöcke: `game-logic` enthält die vollständige Spiellogik als reine Funktionen ohne jeden Zugriff auf Browser, DOM oder Uhr; `game-app` enthält Zeichnen, Spielschleife, Eingabe und Bildschirme. Die Trennung ist nicht Kosmetik — sie erlaubt, die Logik in Node zu testen, obwohl alles in einer HTML-Datei steckt: Die Tests lesen `index.html`, schneiden den Logik-Block heraus und werten ihn aus. Das Spielfeld ist fest 960 × 540 logische Einheiten und wird einheitlich skaliert, die Strecke aus einem festen Keim berechnet. Beides zusammen macht das Spiel geräteunabhängig und die Punktzahlen vergleichbar.

**Tech-Stack:** HTML, CSS, JavaScript (ES2020), Canvas 2D. Keine Bibliotheken, kein Build-Schritt, keine externen Ressourcen zur Laufzeit. Tests mit Nodes eingebautem Test-Runner (`node --test`, Node 20.11 ist vorhanden), ohne Abhängigkeiten. QR-Code mit Python 3.12.

**Spezifikation:** `docs/superpowers/specs/2026-11-16-muhdolfs-geschenke-flug-design.md` — bei Widersprüchen gilt die Spezifikation; melde den Widerspruch, statt ihn stillschweigend aufzulösen.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `index.html` | das vollständige Spiel; die einzige Datei, die ausgeliefert wird |
| `tests/harness.mjs` | schneidet den Block `game-logic` aus `index.html` und lädt ihn in Node |
| `tests/konstanten.test.mjs` | Punkteobergrenze, Mindestlücke, Geschwindigkeiten |
| `tests/physik.test.mjs` | Auftrieb, Schwerkraft, Grenzwerte, Decke, Determinismus |
| `tests/etappen.test.mjs` | Etappenwechsel, Stadtname, Ziel in Bregenz |
| `tests/strecke.test.mjs` | Spielbarkeit der erzeugten Strecke |
| `tests/kollision.test.mjs` | Treffer, Herzen, Unverwundbarkeit, Spielende |
| `tests/punkte.test.mjs` | Punkteberechnung, perfekte Runde, Geschenke |
| `tools/qr.py` | erzeugt den QR-Code aus der fertigen URL |
| `tools/serve.md` | Kurzanleitung, um das Spiel im Heimnetz auf dem Handy zu testen |

Aufbau innerhalb von `index.html`, in dieser Reihenfolge:

1. `<style>` — Layout, Letterbox, HUD, Bildschirme
2. `<canvas id="feld">` — nur die Spielwelt
3. `<div id="hud">` — Punkte, Herzen, Stadtname
4. `<div id="schirm">` — Start, Pause, Ziel, Absturz
5. `<noscript>` und ein Rückfall-Block — enthält die Weihnachtsbotschaft als reinen Text
6. `<script id="game-logic">` — `const GameLogic = (() => { … })()`
7. `<script id="game-app">` — alles, was den Browser berührt

`game-logic` darf `document`, `window`, `Date`, `Math.random` und `performance` **nicht** verwenden. `game-app` darf den Spielzustand nur über `GameLogic`-Funktionen verändern und beim Zeichnen ausschließlich lesen. Wird diese Regel verletzt, hängt das Spielverhalten an der Bildrate, und die Tests sagen nichts mehr aus.

---

## Aufgabe 1: Gerüst und Testharness

**Dateien:**
- Anlegen: `index.html`
- Anlegen: `tests/harness.mjs`
- Test: `tests/konstanten.test.mjs`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/harness.mjs`:

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const wurzel = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Schneidet den Script-Block "game-logic" aus index.html und wertet ihn aus.
 * So laesst sich die Spiellogik in Node testen, obwohl sie in einer HTML-Datei steckt.
 */
export function logikLaden() {
  const html = readFileSync(join(wurzel, 'index.html'), 'utf8');
  const treffer = html.match(/<script id="game-logic">([\s\S]*?)<\/script>/);
  if (!treffer) {
    throw new Error('Script-Block "game-logic" in index.html nicht gefunden');
  }
  const bauen = new Function(`${treffer[1]}\nreturn GameLogic;`);
  const logik = bauen();
  if (!logik || typeof logik !== 'object') {
    throw new Error('Der Block "game-logic" hat kein GameLogic-Objekt geliefert');
  }
  return logik;
}
```

`tests/konstanten.test.mjs`:

```js
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
```

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag prüfen**

Ausführen: `node --test tests/konstanten.test.mjs`
Erwartet: FEHLSCHLAG mit „ENOENT: no such file or directory, open '…index.html'" — die Datei gibt es noch nicht.

- [ ] **Schritt 3: `index.html` mit dem Gerüst und den Konstanten anlegen**

```html
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Muhdolfs Geschenke-Flug</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; height: 100%; overflow: hidden;
    background: #0d1628; color: #f4f7ff;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    touch-action: none; -webkit-user-select: none; user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  #buehne { position: fixed; inset: 0; display: grid; place-items: center; }
  #feld { display: block; border-radius: 6px; }
</style>
</head>
<body>
<div id="buehne"><canvas id="feld"></canvas></div>

<noscript>
  <p>Fuer das Spiel braucht es JavaScript. Aber die Hauptsache geht auch ohne:</p>
  <p><strong>Frohe Weihnachten wuenschen Mona und Michi</strong></p>
</noscript>

<script id="game-logic">
const GameLogic = (() => {
  'use strict';

  // --- Feld und Figur (logische Einheiten, y zaehlt von oben) --------------
  const FIELD = { w: 960, h: 540, groundY: 500 };
  const COW = { w: 56, h: 40, x: 173 };

  // --- Flugphysik ---------------------------------------------------------
  const PHYS = { gravity: 1400, lift: 2600, maxFall: 700, maxRise: 600 };
  const STEP = 1 / 120;

  // --- Spielregeln --------------------------------------------------------
  const HEARTS = 3;
  const INVULN = 1.5;
  const HIT_SHRINK = 0.8;
  const MIN_GAP = 3.2 * COW.h;                      // 128
  const MAX_OBSTACLE_H = FIELD.groundY - MIN_GAP;   // 372
  const GIFT_TOTAL = 50;
  const GIFT_R = 14;

  // --- Etappen ------------------------------------------------------------
  const STAGE_SECONDS = 35;
  const STAGES = [
    { name: 'Bludenz',   crossing: 4.5 },
    { name: 'Feldkirch', crossing: 4.0 },
    { name: 'Dornbirn',  crossing: 3.5 },
    { name: 'Bregenz',   crossing: 3.0 },
  ];
  const TOTAL_SECONDS = STAGES.length * STAGE_SECONDS;  // 140
  const BANNER = 2;        // Sekunden, die der Stadtname steht
  const CLEAR_SPAN = 3;    // Sekunden freie Strecke ab jeder Etappengrenze

  // --- Punkte -------------------------------------------------------------
  const SCORE = {
    perSecond: 10, perGift: 50, finish: 500, perHeart: 100, allGifts: 500,
    max: 10 * TOTAL_SECONDS + 50 * GIFT_TOTAL + 500 + 100 * HEARTS + 500,  // 5200
  };

  const SEED = 20261224;

  /** Scrollgeschwindigkeit der Etappe in Streckeneinheiten pro Sekunde. */
  function rateFor(stage) {
    return (FIELD.w - COW.x) / STAGES[stage].crossing;
  }

  return {
    FIELD, COW, PHYS, STEP, HEARTS, INVULN, HIT_SHRINK, MIN_GAP, MAX_OBSTACLE_H,
    GIFT_TOTAL, GIFT_R, STAGE_SECONDS, STAGES, TOTAL_SECONDS, BANNER, CLEAR_SPAN,
    SCORE, SEED, rateFor,
  };
})();
</script>

<script id="game-app">
'use strict';
// wird in Aufgabe 7 gefuellt
</script>
</body>
</html>
```

- [ ] **Schritt 4: Test laufen lassen und Erfolg prüfen**

Ausführen: `node --test tests/konstanten.test.mjs`
Erwartet: ERFOLG, 5 Tests bestanden.

- [ ] **Schritt 5: Commit**

```bash
git add index.html tests/harness.mjs tests/konstanten.test.mjs
git commit -m "Geruest, Konstanten und Testharness fuer Muhdolfs Geschenke-Flug" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 2: Flugphysik

Muhdolf steigt, solange die Eingabe gehalten wird, und sinkt sonst. Die Höhe wird oben von einer Decke begrenzt; der Boden kommt erst in Aufgabe 5 dazu.

**Dateien:**
- Ändern: `index.html`, Block `game-logic`
- Test: `tests/physik.test.mjs`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/physik.test.mjs`:

```js
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
```

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag prüfen**

Ausführen: `node --test tests/physik.test.mjs`
Erwartet: FEHLSCHLAG mit „L.createState is not a function".

- [ ] **Schritt 3: `createState` und `step` einbauen**

In `index.html`, Block `game-logic`, direkt vor dem `return`-Objekt einfügen:

```js
  // --- Zustand ------------------------------------------------------------

  /**
   * Legt einen Spielzustand an. Die Strecke kann uebergeben werden; das
   * brauchen die Tests, um mit bekannten Hindernissen zu rechnen.
   */
  function createState(route) {
    const strecke = route || buildRoute();
    return {
      phase: 'fliegt',          // 'fliegt' | 'ziel' | 'abgestuerzt'
      t: 0,                     // Flugzeit in Sekunden
      s: 0,                     // Streckenposition der Kamera
      cowY: FIELD.h / 2,        // Mittelpunkt von Muhdolf
      vy: 0,
      hearts: HEARTS,
      invuln: 0,
      giftsTaken: 0,
      stage: 0,
      bannerLeft: 0,            // restliche Anzeigedauer des Stadtnamens
      obstacles: strecke.obstacles,
      gifts: strecke.gifts.map((g) => ({ s: g.s, y: g.y, taken: false })),
      score: 0,
    };
  }

  function clamp(wert, unten, oben) {
    return wert < unten ? unten : wert > oben ? oben : wert;
  }

  /**
   * Rechnet einen Zeitschritt. Veraendert den Zustand an Ort und Stelle und
   * gibt ihn zurueck. Beruehrt nichts ausserhalb des Zustands -- kein DOM,
   * keine Uhr, kein Zufall.
   */
  function step(zustand, auftrieb, dt) {
    if (zustand.phase !== 'fliegt') return zustand;

    zustand.t += dt;
    zustand.s += rateFor(zustand.stage) * dt;
    if (zustand.invuln > 0) zustand.invuln = Math.max(0, zustand.invuln - dt);
    if (zustand.bannerLeft > 0) zustand.bannerLeft = Math.max(0, zustand.bannerLeft - dt);

    const a = PHYS.gravity - (auftrieb ? PHYS.lift : 0);
    zustand.vy = clamp(zustand.vy + a * dt, -PHYS.maxRise, PHYS.maxFall);
    zustand.cowY += zustand.vy * dt;

    const oben = COW.h / 2;
    if (zustand.cowY < oben) {
      zustand.cowY = oben;
      zustand.vy = 0;
    }

    zustand.score = scoreOf(zustand);
    return zustand;
  }

  /** Punktestand zu einem Zustand. Reine Rechnung, kein Seiteneffekt. */
  function scoreOf(zustand) {
    const zeit = Math.floor(Math.min(zustand.t, TOTAL_SECONDS) * SCORE.perSecond);
    let punkte = zeit + zustand.giftsTaken * SCORE.perGift;
    if (zustand.phase === 'ziel') {
      punkte += SCORE.finish + zustand.hearts * SCORE.perHeart;
      if (zustand.giftsTaken >= GIFT_TOTAL) punkte += SCORE.allGifts;
    }
    return punkte;
  }
```

`buildRoute` entsteht erst in Aufgabe 4. Damit die Physiktests jetzt laufen, in derselben Einfügung vorläufig ergänzen:

```js
  // Wird in Aufgabe 4 durch die echte Streckenberechnung ersetzt.
  function buildRoute() {
    return { obstacles: [], gifts: [] };
  }
```

Und das `return`-Objekt erweitern um: `createState, step, scoreOf, buildRoute, clamp`.

- [ ] **Schritt 4: Test laufen lassen und Erfolg prüfen**

Ausführen: `node --test tests/physik.test.mjs`
Erwartet: ERFOLG, 8 Tests bestanden.

- [ ] **Schritt 5: Commit**

```bash
git add index.html tests/physik.test.mjs
git commit -m "Flugphysik mit fester Schrittweite und Deckenbegrenzung" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 3: Etappen und Zielerreichung

Nach 35 Sekunden beginnt die nächste Etappe, nach 140 Sekunden ist Bregenz erreicht.

**Dateien:**
- Ändern: `index.html`, Block `game-logic`
- Test: `tests/etappen.test.mjs`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/etappen.test.mjs`:

```js
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
```

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag prüfen**

Ausführen: `node --test tests/etappen.test.mjs`
Erwartet: FEHLSCHLAG — „die Etappen wechseln alle 35 Sekunden" liefert `0` statt `1`, und `phase` bleibt `fliegt`.

- [ ] **Schritt 3: Etappenfortschritt und Ziel einbauen**

In `step`, nach der Deckenbegrenzung und **vor** `zustand.score = scoreOf(zustand)` einfügen:

```js
    const etappe = Math.min(STAGES.length - 1, Math.floor(zustand.t / STAGE_SECONDS));
    if (etappe !== zustand.stage) {
      zustand.stage = etappe;
      zustand.bannerLeft = BANNER;
    }

    if (zustand.t >= TOTAL_SECONDS) {
      zustand.t = TOTAL_SECONDS;        // genau abschneiden, sonst stimmt die Obergrenze nicht
      zustand.phase = 'ziel';
    }
```

Der Zuschnitt von `t` ist kein Schönheitsfehler: Ohne ihn liefert ein Lauf je nach Bildrate 1400 oder 1401 Punkte, und „von 5200" wäre gelogen.

- [ ] **Schritt 4: Test laufen lassen und Erfolg prüfen**

Ausführen: `node --test tests/etappen.test.mjs`
Erwartet: ERFOLG, 6 Tests bestanden.

- [ ] **Schritt 5: Alle Tests laufen lassen**

Ausführen: `node --test tests/`
Erwartet: ERFOLG, 19 Tests bestanden.

- [ ] **Schritt 6: Commit**

```bash
git add index.html tests/etappen.test.mjs
git commit -m "Etappenfortschritt, Stadtname-Einblendung und Ziel in Bregenz" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 4: Die feste Strecke

Die Strecke wird aus einem festen Keim berechnet: überall dieselbe Runde, ohne lange Tabelle im Quelltext. Die Tests prüfen sie auf Spielbarkeit — eine unfaire Strecke soll ein Test melden, nicht ein Empfänger.

**Dateien:**
- Ändern: `index.html`, Block `game-logic`
- Test: `tests/strecke.test.mjs`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/strecke.test.mjs`:

```js
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
```

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag prüfen**

Ausführen: `node --test tests/strecke.test.mjs`
Erwartet: FEHLSCHLAG — die vorläufige `buildRoute` liefert eine leere Strecke, „die Strecke enthaelt genau 50 Geschenke" meldet `0 !== 50`.

- [ ] **Schritt 3: Die Streckenberechnung einbauen**

In `index.html`, Block `game-logic`, die vorläufige `buildRoute` durch Folgendes ersetzen:

```js
  // --- Strecke ------------------------------------------------------------

  /** Kleiner Zufallsgenerator mit Keim (mulberry32). Gleiche Zahlen ueberall. */
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Streckenposition, die die Kamera zur Flugzeit t erreicht hat. */
  function sAtTime(t) {
    let s = 0;
    for (let i = 0; i < STAGES.length; i++) {
      const anfang = i * STAGE_SECONDS;
      if (t <= anfang) break;
      s += rateFor(i) * (Math.min(t, anfang + STAGE_SECONDS) - anfang);
    }
    return s;
  }

  function stageAt(t) {
    return Math.min(STAGES.length - 1, Math.floor(t / STAGE_SECONDS));
  }

  /** Liegt die Ankunftszeit in einem freizuhaltenden Abschnitt? */
  function imFreienAbschnitt(ta) {
    for (let k = 1; k < STAGES.length; k++) {
      const grenze = k * STAGE_SECONDS;
      if (ta >= grenze - 0.4 && ta <= grenze + CLEAR_SPAN + 0.4) return true;
    }
    return false;
  }

  /** Hoechste erlaubte Hindernishoehe der Etappe -- spaeter wird es enger. */
  function obstacleRange(stage) {
    const min = 90 + stage * 22;
    const max = Math.min(MAX_OBSTACLE_H, min + 140);
    return { min, max };
  }

  const OBSTACLE_KINDS = [
    { boden: 'felszacken', decke: 'gondel' },      // Bludenz
    { boden: 'burgturm',   decke: 'eiszapfen' },   // Feldkirch
    { boden: 'hausdach',   decke: 'seilbahn' },    // Dornbirn
    { boden: 'seebuehne',  decke: 'moewe' },       // Bregenz
  ];

  /**
   * Haelt eine Wunschhoehe so, dass sie in der Luecke bei s liegt.
   * Dadurch landet kein Geschenk in einem Hindernis.
   */
  function inDieLuecke(obstacles, s, yWunsch) {
    const rand = GIFT_R + 10;
    let oben = COW.h / 2;
    let unten = FIELD.groundY - COW.h / 2;
    for (const o of obstacles) {
      if (Math.abs(s - o.s) > o.w / 2 + GIFT_R + 14) continue;
      if (o.from === 'boden') unten = Math.min(unten, FIELD.groundY - o.h - rand);
      else oben = Math.max(oben, o.h + rand);
    }
    if (oben > unten) return (oben + unten) / 2;
    return clamp(yWunsch, oben, unten);
  }

  /**
   * Berechnet die Strecke. Immer dasselbe Ergebnis, auf jedem Geraet.
   *
   * Hindernisse stehen einzeln im Weg, abwechselnd vom Boden und von der
   * Decke. Geschenke kommen in Gruppen; etwa die Haelfte liegt bequem in der
   * Fluglinie, der Rest kostet Mut oder eine geuebte Hand. Durchkommen soll
   * leicht sein, alle 50 Geschenke zu holen schwer.
   */
  function buildRoute() {
    const rnd = makeRng(SEED);
    const obstacles = [];
    let vonDerDecke = false;

    for (let ta = 4.5; ta < TOTAL_SECONDS - 2.5; ta += 1.45 + rnd() * 0.95) {
      if (imFreienAbschnitt(ta)) continue;
      const stage = stageAt(ta);
      const { min, max } = obstacleRange(stage);
      const h = Math.round(min + rnd() * (max - min));
      obstacles.push({
        ta: Math.round(ta * 1000) / 1000,
        s: sAtTime(ta) + COW.x,
        from: vonDerDecke ? 'decke' : 'boden',
        kind: OBSTACLE_KINDS[stage][vonDerDecke ? 'decke' : 'boden'],
        w: 54 + Math.round(rnd() * 34),
        h,
        stage,
      });
      vonDerDecke = !vonDerDecke;
    }

    // 14 Gruppen, zusammen genau 50 Geschenke.
    const gruppen = [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 4, 4];
    const klassen = ['bequem', 'riskant', 'bequem', 'knifflig', 'bequem', 'riskant',
      'bequem', 'riskant', 'bequem', 'knifflig', 'bequem', 'riskant', 'bequem', 'riskant'];
    const gifts = [];
    let ta = 6;
    for (let i = 0; i < gruppen.length && gifts.length < GIFT_TOTAL; i++) {
      const anzahl = Math.min(gruppen[i], GIFT_TOTAL - gifts.length);
      gifts.push(...gruppeSetzen(obstacles, rnd, ta, anzahl, klassen[i]));
      ta += 9.2;
    }

    return { obstacles, gifts };
  }

  /** Setzt eine Gruppe Geschenke ab der Ankunftszeit ta. */
  function gruppeSetzen(obstacles, rnd, ta, anzahl, klasse) {
    const stage = stageAt(ta);
    const schritt = 46;                       // Abstand innerhalb der Gruppe
    const s0 = sAtTime(ta) + COW.x;
    const bequem = 200 + rnd() * 120;         // mittlere Flughoehe
    const liste = [];

    for (let i = 0; i < anzahl; i++) {
      const s = s0 + i * schritt;
      let wunsch;
      if (klasse === 'bequem') {
        wunsch = bequem + Math.sin(i * 0.9) * 26;
      } else if (klasse === 'riskant') {
        // dicht an die Luecke eines Hindernisses in der Naehe
        const nah = obstacles.find((o) => Math.abs(o.s - s) < 320);
        wunsch = !nah ? bequem
          : nah.from === 'boden'
            ? FIELD.groundY - nah.h - 46
            : nah.h + 46;
      } else {
        // knifflig: Zickzack mit grossem Hub
        wunsch = i % 2 === 0 ? 110 : FIELD.groundY - 110;
      }
      liste.push({ s, y: Math.round(inDieLuecke(obstacles, s, wunsch)), stage: stageAt(ta), klasse });
    }
    return liste;
  }
```

Das `return`-Objekt erweitern um: `makeRng, sAtTime, stageAt, buildRoute, obstacleRange`.

- [ ] **Schritt 4: Test laufen lassen und Erfolg prüfen**

Ausführen: `node --test tests/strecke.test.mjs`
Erwartet: ERFOLG, 11 Tests bestanden.

Schlägt „jede Luecke ist mindestens 3,2 Kuhhoehen hoch", „es steht immer nur ein Hindernis im Weg" oder „die Geschenke verteilen sich ueber alle vier Etappen" fehl, dann nicht den Test lockern, sondern `obstacleRange`, den Abstand in der `for`-Schleife oder `SEED` anpassen und erneut laufen lassen. Der Test beschreibt, was eine faire Strecke ist.

- [ ] **Schritt 5: Commit**

```bash
git add index.html tests/strecke.test.mjs
git commit -m "Feste Strecke aus festem Keim, mit Pruefung auf Spielbarkeit" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 5: Kollision, Herzen, Unverwundbarkeit

**Dateien:**
- Ändern: `index.html`, Block `game-logic`
- Test: `tests/kollision.test.mjs`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/kollision.test.mjs`:

```js
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
  const { z } = mitHindernis({ h: 300, cowY: 460 });
  einSchritt(z);
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
```

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag prüfen**

Ausführen: `node --test tests/kollision.test.mjs`
Erwartet: FEHLSCHLAG — „ein Treffer kostet ein Herz" meldet `3 !== 2`; es gibt noch keine Kollisionsprüfung.

- [ ] **Schritt 3: Kollision einbauen**

In `index.html`, Block `game-logic`, vor `createState` einfügen:

```js
  // --- Kollision ----------------------------------------------------------

  /** Trefferflaeche von Muhdolf, auf 80 % geschrumpft. */
  function cowBox(zustand) {
    const hw = (COW.w * HIT_SHRINK) / 2;
    const hh = (COW.h * HIT_SHRINK) / 2;
    const mitte = zustand.s + COW.x;
    return { x0: mitte - hw, x1: mitte + hw, y0: zustand.cowY - hh, y1: zustand.cowY + hh };
  }

  /** Trefferflaeche eines Hindernisses, ebenfalls auf 80 % geschrumpft. */
  function obstacleBox(o) {
    const hw = (o.w * HIT_SHRINK) / 2;
    const h = o.h * HIT_SHRINK;
    return o.from === 'boden'
      ? { x0: o.s - hw, x1: o.s + hw, y0: FIELD.groundY - h, y1: FIELD.groundY }
      : { x0: o.s - hw, x1: o.s + hw, y0: 0, y1: h };
  }

  function ueberlappt(a, b) {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  }

  /**
   * Zieht ein Herz ab und setzt Muhdolf auf eine freie Hoehe. Ohne das
   * Versetzen bliebe sie im selben Hindernis stecken und verlore alle drei
   * Herzen auf einen Schlag.
   */
  function treffer(zustand, freieHoehe) {
    if (zustand.invuln > 0) return;
    zustand.hearts -= 1;
    zustand.vy = 0;
    zustand.cowY = clamp(freieHoehe, COW.h / 2, FIELD.groundY - COW.h / 2);
    zustand.invuln = INVULN;
    if (zustand.hearts <= 0) {
      zustand.hearts = 0;
      zustand.phase = 'abgestuerzt';
    }
  }
```

In `step`, nach der Deckenbegrenzung und vor dem Etappenfortschritt einfügen:

```js
    // Boden
    const unten = FIELD.groundY - COW.h / 2;
    if (zustand.cowY > unten) {
      zustand.cowY = unten;
      zustand.vy = 0;
      treffer(zustand, unten - 70);
    }

    // Hindernisse
    if (zustand.phase === 'fliegt' && zustand.invuln <= 0) {
      const kuh = cowBox(zustand);
      for (const o of zustand.obstacles) {
        if (Math.abs(o.s - (zustand.s + COW.x)) > o.w / 2 + COW.w) continue;
        if (!ueberlappt(kuh, obstacleBox(o))) continue;
        const frei = o.from === 'boden'
          ? FIELD.groundY - o.h - COW.h / 2 - 24
          : o.h + COW.h / 2 + 24;
        treffer(zustand, frei);
        break;
      }
    }
```

Das `return`-Objekt erweitern um: `cowBox, obstacleBox, ueberlappt`.

- [ ] **Schritt 4: Test laufen lassen und Erfolg prüfen**

Ausführen: `node --test tests/kollision.test.mjs`
Erwartet: ERFOLG, 9 Tests bestanden.

- [ ] **Schritt 5: Alle Tests laufen lassen**

Ausführen: `node --test tests/`
Erwartet: ERFOLG, 39 Tests bestanden.

- [ ] **Schritt 6: Commit**

```bash
git add index.html tests/kollision.test.mjs
git commit -m "Kollision, Herzen und Unverwundbarkeit nach einem Treffer" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 6: Geschenke einsammeln und Punkte

**Dateien:**
- Ändern: `index.html`, Block `game-logic`
- Test: `tests/punkte.test.mjs`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`tests/punkte.test.mjs`:

```js
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
```

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag prüfen**

Ausführen: `node --test tests/punkte.test.mjs`
Erwartet: FEHLSCHLAG — „ein Geschenk im Weg wird eingesammelt" meldet `0 !== 1`.

- [ ] **Schritt 3: Das Einsammeln einbauen**

In `step`, nach der Hindernisprüfung und vor dem Etappenfortschritt einfügen:

```js
    // Geschenke
    const kuhG = cowBox(zustand);
    for (const g of zustand.gifts) {
      if (g.taken) continue;
      if (Math.abs(g.s - (zustand.s + COW.x)) > GIFT_R + COW.w) continue;
      const kasten = { x0: g.s - GIFT_R, x1: g.s + GIFT_R, y0: g.y - GIFT_R, y1: g.y + GIFT_R };
      if (!ueberlappt(kuhG, kasten)) continue;
      g.taken = true;
      zustand.giftsTaken += 1;
    }
```

- [ ] **Schritt 4: Test laufen lassen und Erfolg prüfen**

Ausführen: `node --test tests/punkte.test.mjs`
Erwartet: ERFOLG, 9 Tests bestanden.

- [ ] **Schritt 5: Alle Tests laufen lassen**

Ausführen: `node --test tests/`
Erwartet: ERFOLG, 48 Tests bestanden.

- [ ] **Schritt 6: Commit**

```bash
git add index.html tests/punkte.test.mjs
git commit -m "Geschenke einsammeln und vollstaendige Punkteberechnung" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 7: Spielbarer Rohbau — Canvas, Schleife, Eingabe

Ab hier verlässt die Arbeit den Testbereich: Zeichnen, Bildrate und Eingabe lassen sich nicht sinnvoll automatisiert prüfen, dafür aber in zehn Sekunden von Hand. Diese Aufgabe macht das Spiel erstmals spielbar — mit schlichten Formen. Aufgabe 8 kleidet es ein.

**Dateien:**
- Ändern: `index.html`, Block `game-app` und `<style>`

- [ ] **Schritt 1: Canvas-Vermessung und Skalierung einbauen**

Block `game-app` ersetzen durch:

```js
'use strict';

const L = GameLogic;
const canvas = document.getElementById('feld');
const ctx = canvas.getContext('2d');

let zustand = L.createState();
let auftrieb = false;
let pausiert = false;
let laeuft = false;              // true, sobald losgeflogen wurde

/**
 * Passt das Canvas ans Fenster an. Das Spielfeld bleibt 960 x 540 logische
 * Einheiten und wird einheitlich skaliert -- nur so sehen alle dasselbe und
 * nur so sind die Punktzahlen vergleichbar.
 */
function vermessen() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const skala = Math.min(window.innerWidth / L.FIELD.w, window.innerHeight / L.FIELD.h);
  const breite = Math.max(1, Math.floor(L.FIELD.w * skala));
  const hoehe = Math.max(1, Math.floor(L.FIELD.h * skala));
  canvas.style.width = breite + 'px';
  canvas.style.height = hoehe + 'px';
  canvas.width = Math.round(breite * dpr);
  canvas.height = Math.round(hoehe * dpr);
  ctx.setTransform(canvas.width / L.FIELD.w, 0, 0, canvas.height / L.FIELD.h, 0, 0);
}

vermessen();
window.addEventListener('resize', vermessen);
```

- [ ] **Schritt 2: Eingabe einbauen**

Darunter einfügen:

```js
/**
 * Alle Eingabequellen setzen dasselbe Flag. Die Spiellogik erfaehrt nie,
 * ob der Auftrieb von einem Finger, der Maus oder der Leertaste kam.
 */
function auftriebAn(ereignis) {
  if (ereignis && ereignis.target && ereignis.target.closest &&
      ereignis.target.closest('button')) return;      // Knöpfe bleiben Knöpfe
  auftrieb = true;
}
function auftriebAus() {
  auftrieb = false;
}

window.addEventListener('pointerdown', auftriebAn);
window.addEventListener('pointerup', auftriebAus);
window.addEventListener('pointercancel', auftriebAus);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();                                // sonst scrollt die Seite
    auftriebAn(e);
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') auftriebAus();
});
window.addEventListener('blur', auftriebAus);
window.addEventListener('contextmenu', (e) => e.preventDefault());
```

- [ ] **Schritt 3: Spielschleife mit fester Schrittweite einbauen**

Darunter einfügen:

```js
let letzterRahmen = 0;
let akku = 0;

/**
 * Ein Bild. Die Physik laeuft in festen Schritten von 1/120 s, unabhaengig
 * von der Bildrate -- sonst fliegt Muhdolf auf einem 120-Hz-Handy doppelt so
 * schnell wie auf einem 60-Hz-Laptop.
 */
function rahmen(jetzt) {
  requestAnimationFrame(rahmen);
  if (!letzterRahmen) letzterRahmen = jetzt;
  let dt = (jetzt - letzterRahmen) / 1000;
  letzterRahmen = jetzt;
  if (dt > 0.25) dt = 0.25;

  if (laeuft && !pausiert && zustand.phase === 'fliegt') {
    akku += dt;
    let schritte = 0;
    while (akku >= L.STEP && schritte < 5) {
      L.step(zustand, auftrieb, L.STEP);
      akku -= L.STEP;
      schritte += 1;
    }
    // Lief die Obergrenze voll, war das Fenster weg: aufgelaufene Zeit
    // verwerfen statt sie in einem Rutsch nachzurechnen.
    if (schritte === 5) akku = 0;
    if (zustand.phase !== 'fliegt') laeuft = false;
  }

  zeichnen(zustand, dt);
}

requestAnimationFrame(rahmen);
```

- [ ] **Schritt 4: Schlichtes Zeichnen einbauen**

Darunter einfügen — das wird in Aufgabe 8 durch die Vorarlberg-Kulisse ersetzt, macht das Spiel aber jetzt schon spielbar:

```js
function zeichnen(z) {
  // Himmel
  ctx.fillStyle = '#2d4b7d';
  ctx.fillRect(0, 0, L.FIELD.w, L.FIELD.groundY);
  // Boden
  ctx.fillStyle = '#eaf1fb';
  ctx.fillRect(0, L.FIELD.groundY, L.FIELD.w, L.FIELD.h - L.FIELD.groundY);

  // Hindernisse
  ctx.fillStyle = '#16233d';
  for (const o of z.obstacles) {
    const x = o.s - z.s;
    if (x < -120 || x > L.FIELD.w + 120) continue;
    const y = o.from === 'boden' ? L.FIELD.groundY - o.h : 0;
    ctx.fillRect(x - o.w / 2, y, o.w, o.h);
  }

  // Geschenke
  ctx.fillStyle = '#e4b43c';
  for (const g of z.gifts) {
    if (g.taken) continue;
    const x = g.s - z.s;
    if (x < -40 || x > L.FIELD.w + 40) continue;
    ctx.fillRect(x - L.GIFT_R, g.y - L.GIFT_R, L.GIFT_R * 2, L.GIFT_R * 2);
  }

  // Muhdolf
  ctx.globalAlpha = z.invuln > 0 && Math.floor(z.invuln * 10) % 2 === 0 ? 0.4 : 1;
  ctx.fillStyle = '#f7f9fc';
  ctx.fillRect(L.COW.x - L.COW.w / 2, z.cowY - L.COW.h / 2, L.COW.w, L.COW.h);
  ctx.globalAlpha = 1;

  // Behelfsanzeige, bis Aufgabe 9 das HUD baut
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`${z.score}  |  ${L.STAGES[z.stage].name}  |  ${'♥'.repeat(z.hearts)}  |  ${z.giftsTaken}/50  |  ${z.phase}`, 16, 30);
}

// Vorlaeufiger Start, bis Aufgabe 9 den Startbildschirm baut.
laeuft = true;
```

- [ ] **Schritt 5: Von Hand prüfen**

`index.html` im Browser öffnen (Doppelklick genügt, es braucht keinen Webserver).

Erwartet:
- Der weiße Kasten sinkt von allein und steigt, solange die Maustaste oder die Leertaste gehalten wird.
- Dunkle Kästen kommen von rechts; Berührung lässt die Herzen weniger werden und der Kasten blinkt kurz.
- Gelbe Kästen verschwinden beim Durchfliegen, der Zähler steigt um eins und die Punkte um 50.
- Nach 35 Sekunden wechselt der Stadtname auf Feldkirch, das Scrollen wird schneller.
- Die Leertaste scrollt die Seite nicht.
- Beim Verkleinern des Fensters bleibt das Feld vollständig sichtbar und wird nicht verzerrt.

Stimmt etwas davon nicht, zuerst in der Konsole nach Fehlern sehen; die Logik ist durch 48 Tests gedeckt, der Fehler liegt dann in diesem Block.

- [ ] **Schritt 6: Commit**

```bash
git add index.html
git commit -m "Spielbarer Rohbau: Canvas-Skalierung, feste Schrittweite, Eingabe" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 8: Die Vorarlberg-Kulisse

Vier Etappen mit Wiedererkennungswert, gezeichnet aus Pfaden: Hochgebirge über Bludenz, Schattenburg in Feldkirch, das Rote Haus in Dornbirn, Martinsturm und Seebühne am Bodensee.

**Dateien:**
- Ändern: `index.html`, Block `game-app`

**Hinweis zur Spezifikation:** Die Spezifikation nennt für Feldkirch unter den Hindernissen eine „Kirchturmspitze". Eine Kirchturmspitze, die vom Himmel herabhängt, sähe falsch aus — der Kirchturm bleibt deshalb in der Kulisse, und das hängende Hindernis sind Eiszapfen an einem Altstadtbogen. Dasselbe Spielgefühl, nur ohne schwebende Kirche.

- [ ] **Schritt 1: Hilfsfunktionen für Parallaxe und Bergzüge einbauen**

Die Funktion `zeichnen` aus Aufgabe 7 löschen und ab dieser Stelle neu aufbauen. Zuerst die Werkzeuge:

```js
// --- Zeichenwerkzeug ----------------------------------------------------

/** Ruft f fuer jede Wiederholung einer Kachel auf -- daraus entsteht die Parallaxe. */
function kachel(versatz, periode, f) {
  const start = -(((versatz % periode) + periode) % periode);
  for (let x = start; x < L.FIELD.w + periode; x += periode) f(x);
}

/** Ein Bergzug aus Gipfelpunkten, beliebig oft wiederholt. */
function bergZug(versatz, periode, basisY, gipfel, farbe, schnee) {
  kachel(versatz, periode, (x0) => {
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.moveTo(x0, basisY);
    for (const [dx, dy] of gipfel) ctx.lineTo(x0 + dx, basisY - dy);
    ctx.lineTo(x0 + periode, basisY);
    ctx.closePath();
    ctx.fill();
    if (!schnee) return;
    // Schneekappen auf die hohen Gipfel
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (let i = 1; i < gipfel.length - 1; i++) {
      const [dx, dy] = gipfel[i];
      if (dy < gipfel[i - 1][1] || dy < gipfel[i + 1][1]) continue;
      const breite = Math.min(26, dy * 0.16);
      ctx.beginPath();
      ctx.moveTo(x0 + dx, basisY - dy);
      ctx.lineTo(x0 + dx - breite, basisY - dy + breite * 1.5);
      ctx.lineTo(x0 + dx + breite, basisY - dy + breite * 1.5);
      ctx.closePath();
      ctx.fill();
    }
  });
}

/** Eine Reihe Giebelhaeuser. */
function dachzeile(versatz, periode, basisY, farbe) {
  kachel(versatz, periode, (x0) => {
    ctx.fillStyle = farbe;
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * (periode / 4);
      const b = periode / 4 - 8;
      const h = 44 + ((i * 17) % 30);
      ctx.fillRect(x, basisY - h, b, h);
      ctx.beginPath();
      ctx.moveTo(x - 4, basisY - h);
      ctx.lineTo(x + b / 2, basisY - h - 20);
      ctx.lineTo(x + b + 4, basisY - h);
      ctx.closePath();
      ctx.fill();
    }
  });
}

/** Turm mit Dach: 'spitz', 'zwiebel' oder 'zinnen'. */
function turm(x, basisY, breite, hoehe, farbe, dach) {
  ctx.fillStyle = farbe;
  ctx.fillRect(x, basisY - hoehe, breite, hoehe);
  const oben = basisY - hoehe;
  if (dach === 'spitz') {
    ctx.beginPath();
    ctx.moveTo(x - 5, oben);
    ctx.lineTo(x + breite / 2, oben - breite * 1.4);
    ctx.lineTo(x + breite + 5, oben);
    ctx.closePath();
    ctx.fill();
  } else if (dach === 'zwiebel') {
    ctx.beginPath();
    ctx.moveTo(x - 3, oben);
    ctx.bezierCurveTo(x - 10, oben - breite * 0.8, x + breite / 2 - 6, oben - breite * 1.1,
      x + breite / 2, oben - breite * 1.3);
    ctx.bezierCurveTo(x + breite / 2 + 6, oben - breite * 1.1, x + breite + 10, oben - breite * 0.8,
      x + breite + 3, oben);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x + breite / 2 - 1, oben - breite * 1.6, 2, breite * 0.3);
  } else {
    for (let i = 0; i < 4; i++) ctx.fillRect(x + i * (breite / 4), oben - 8, breite / 6, 8);
  }
}

/** Nadelbaum. */
function tanne(x, basisY, hoehe, farbe) {
  ctx.fillStyle = farbe;
  const b = hoehe * 0.42;
  for (let i = 0; i < 3; i++) {
    const y = basisY - (hoehe / 3) * i;
    const s = 1 - i * 0.22;
    ctx.beginPath();
    ctx.moveTo(x - (b / 2) * s, y);
    ctx.lineTo(x, y - hoehe * 0.45);
    ctx.lineTo(x + (b / 2) * s, y);
    ctx.closePath();
    ctx.fill();
  }
}
```

- [ ] **Schritt 2: Die vier Kulissen einbauen**

```js
// --- Kulissen -----------------------------------------------------------

const HIMMEL = [
  ['#0e1d3c', '#294574', '#6480b4'],   // Bludenz: tiefe Bergnacht
  ['#16274a', '#365284', '#7a90bf'],   // Feldkirch
  ['#1c2e53', '#44608d', '#93a6cb'],   // Dornbirn
  ['#243760', '#5a7398', '#b6c4dd'],   // Bregenz: Morgen am See
];

// Gipfelzuege: [Abstand vom Kachelanfang, Hoehe ueber der Basislinie]
const RAETIKON = [[0, 60], [90, 210], [180, 120], [280, 300], [380, 160],
  [470, 250], [560, 130], [660, 230], [760, 90], [860, 170]];
const ZIMBA = [[0, 40], [110, 150], [220, 300], [300, 120], [400, 210],
  [520, 100], [620, 180], [720, 70]];
const HUEGEL = [[0, 40], [120, 110], [240, 70], [380, 130], [500, 80], [620, 120], [740, 50]];

/** Zeichnet die Kulisse einer Etappe zur Streckenposition s. */
function kulisse(stage, s) {
  const farben = HIMMEL[stage];
  const g = ctx.createLinearGradient(0, 0, 0, L.FIELD.groundY);
  g.addColorStop(0, farben[0]);
  g.addColorStop(0.55, farben[1]);
  g.addColorStop(1, farben[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.FIELD.w, L.FIELD.groundY);
  sterne(stage);

  if (stage === 0) kulisseBludenz(s);
  else if (stage === 1) kulisseFeldkirch(s);
  else if (stage === 2) kulisseDornbirn(s);
  else kulisseBregenz(s);

  boden(stage, s);
}

/** Sterne, in den spaeteren Etappen immer blasser -- es wird Morgen. */
function sterne(stage) {
  ctx.globalAlpha = 0.5 - stage * 0.12;
  if (ctx.globalAlpha <= 0) { ctx.globalAlpha = 1; return; }
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 46; i++) {
    const x = (i * 137) % L.FIELD.w;
    const y = (i * 71) % 220;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

/** Bludenz: Hochgebirge in drei Staffeln, davor die Schokoladefabrik. */
function kulisseBludenz(s) {
  bergZug(s * 0.05, 880, 470, RAETIKON, '#1b2b4d', true);
  bergZug(s * 0.12, 740, 480, ZIMBA, '#263a62', true);
  kachel(s * 0.26, 520, (x0) => {
    ctx.fillStyle = '#14223c';
    ctx.beginPath();
    ctx.moveTo(x0, 500);
    ctx.quadraticCurveTo(x0 + 130, 420, x0 + 260, 490);
    ctx.quadraticCurveTo(x0 + 400, 430, x0 + 520, 500);
    ctx.closePath();
    ctx.fill();
    tanne(x0 + 70, 480, 54, '#0f1b31');
    tanne(x0 + 330, 470, 62, '#0f1b31');
    schokoladefabrik(x0 + 190, 478);
  });
}

/** Die Schokoladefabrik in Bludenz -- Muhdolfs Heimat. */
function schokoladefabrik(x, basisY) {
  ctx.fillStyle = '#243a60';
  ctx.fillRect(x, basisY - 34, 76, 34);
  ctx.fillRect(x + 54, basisY - 62, 14, 28);          // Schornstein
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 8 + i * 16, basisY - 26, 8, 8);
  ctx.globalAlpha = 0.35;                              // Rauchfahne
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + 61, basisY - 72, 9, 0, Math.PI * 2);
  ctx.arc(x + 70, basisY - 86, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Feldkirch: Schattenburg auf dem Huegel, Katzenturm, Altstadtdaecher. */
function kulisseFeldkirch(s) {
  bergZug(s * 0.05, 760, 478, HUEGEL, '#1e2e52', true);
  kachel(s * 0.12, 700, (x0) => {
    ctx.fillStyle = '#2a3c63';
    ctx.beginPath();                                   // Burghuegel
    ctx.moveTo(x0 + 60, 486);
    ctx.quadraticCurveTo(x0 + 190, 380, x0 + 330, 486);
    ctx.closePath();
    ctx.fill();
    // Schattenburg: breiter Bau mit hohem Bergfried
    ctx.fillStyle = '#33497a';
    ctx.fillRect(x0 + 140, 404, 110, 54);
    turm(x0 + 196, 404, 32, 62, '#33497a', 'spitz');
    turm(x0 + 148, 404, 20, 34, '#33497a', 'zinnen');
    // Katzenturm, der dicke Rundturm
    turm(x0 + 470, 486, 40, 86, '#2f4371', 'zinnen');
  });
  dachzeile(s * 0.26, 520, 498, '#192843');
}

/** Dornbirn: Karren mit Seilbahn, Rotes Haus am Marktplatz. */
function kulisseDornbirn(s) {
  bergZug(s * 0.05, 820, 482, HUEGEL, '#22335a', false);
  kachel(s * 0.12, 760, (x0) => {
    ctx.fillStyle = '#2b3f6b';
    ctx.beginPath();                                   // Karren
    ctx.moveTo(x0 + 420, 490);
    ctx.quadraticCurveTo(x0 + 560, 350, x0 + 720, 490);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';        // Seilbahntrasse
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0 + 300, 470);
    ctx.lineTo(x0 + 566, 362);
    ctx.stroke();
    rotesHaus(x0 + 120, 492);
  });
  dachzeile(s * 0.26, 498, 500, '#1a2b47');
}

/** Das Rote Haus: Rheintalhaus mit rot-weissem Fachwerk und Treppengiebel. */
function rotesHaus(x, basisY) {
  ctx.fillStyle = '#8e2b2b';
  ctx.fillRect(x, basisY - 78, 92, 78);
  ctx.beginPath();                                     // Walmdach
  ctx.moveTo(x - 6, basisY - 78);
  ctx.lineTo(x + 46, basisY - 112);
  ctx.lineTo(x + 98, basisY - 78);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';          // Fachwerk
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x, basisY - 78 + i * 19);
    ctx.lineTo(x + 92, basisY - 78 + i * 19);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,230,160,0.85)';            // erleuchtete Fenster
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 12 + i * 28, basisY - 34, 12, 14);
}

/** Bregenz: Pfaender, Martinsturm, Seebuehne auf dem Bodensee. */
function kulisseBregenz(s) {
  kachel(s * 0.05, 900, (x0) => {
    ctx.fillStyle = '#26395f';
    ctx.beginPath();                                   // Pfaender
    ctx.moveTo(x0, 486);
    ctx.quadraticCurveTo(x0 + 220, 330, x0 + 470, 486);
    ctx.closePath();
    ctx.fill();
  });
  kachel(s * 0.12, 820, (x0) => {
    // Oberstadt mit dem Martinsturm und seiner Zwiebelhaube
    ctx.fillStyle = '#2f4673';
    ctx.fillRect(x0 + 120, 440, 90, 48);
    turm(x0 + 150, 440, 34, 54, '#36507f', 'zwiebel');
    dachzeile(x0 * 0 + s * 0.12 + 300, 420, 488, '#243a63');
    seebuehne(x0 + 520, 492);
  });
}

/** Die Seebuehne: Podest im Wasser mit Aufbauten und Lichterkette. */
function seebuehne(x, basisY) {
  ctx.fillStyle = '#1f3557';
  ctx.fillRect(x, basisY - 14, 150, 14);
  ctx.beginPath();                                     // Kulissenbogen
  ctx.moveTo(x + 20, basisY - 14);
  ctx.quadraticCurveTo(x + 75, basisY - 96, x + 130, basisY - 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,120,0.9)';             // Lichter
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(x + 26 + i * 16, basisY - 30 - Math.sin(i * 0.5) * 22, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Boden: Schnee in den ersten drei Etappen, Bodensee in Bregenz. */
function boden(stage, s) {
  const y = L.FIELD.groundY;
  const h = L.FIELD.h - y;
  if (stage === 3) {
    const g = ctx.createLinearGradient(0, y, 0, L.FIELD.h);
    g.addColorStop(0, '#2f6a94');
    g.addColorStop(1, '#122d46');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, L.FIELD.w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.6;
    kachel(s * 0.55, 130, (x) => {
      ctx.beginPath();
      ctx.moveTo(x, y + 13);
      ctx.quadraticCurveTo(x + 32, y + 6, x + 65, y + 13);
      ctx.quadraticCurveTo(x + 98, y + 20, x + 130, y + 13);
      ctx.stroke();
    });
  } else {
    ctx.fillStyle = '#e9f1fb';
    ctx.fillRect(0, y, L.FIELD.w, h);
    ctx.fillStyle = '#d2deef';
    kachel(s * 0.9, 170, (x) => {
      ctx.beginPath();
      ctx.ellipse(x + 85, y + 8, 76, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
```

- [ ] **Schritt 3: Hindernisse, Geschenke und Muhdolf zeichnen**

```js
// --- Hindernisse und Geschenke ------------------------------------------

function hindernis(o, s) {
  const x = o.s - s;
  if (x < -140 || x > L.FIELD.w + 140) return;
  const b = o.w;
  if (o.kind === 'felszacken') {
    ctx.fillStyle = '#121f38';
    ctx.beginPath();
    ctx.moveTo(x - b / 2, L.FIELD.groundY);
    ctx.lineTo(x - b * 0.18, L.FIELD.groundY - o.h);
    ctx.lineTo(x + b * 0.2, L.FIELD.groundY - o.h * 0.82);
    ctx.lineTo(x + b / 2, L.FIELD.groundY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(x - b * 0.18, L.FIELD.groundY - o.h);
    ctx.lineTo(x - b * 0.3, L.FIELD.groundY - o.h + 20);
    ctx.lineTo(x + b * 0.14, L.FIELD.groundY - o.h * 0.82 + 10);
    ctx.lineTo(x + b * 0.2, L.FIELD.groundY - o.h * 0.82);
    ctx.closePath();
    ctx.fill();
  } else if (o.kind === 'burgturm') {
    turm(x - b / 2, L.FIELD.groundY, b, o.h, '#1d2f52', 'zinnen');
    ctx.fillStyle = 'rgba(255,220,150,0.8)';
    for (let i = 1; i * 46 < o.h - 20; i++) ctx.fillRect(x - 5, L.FIELD.groundY - i * 46, 10, 13);
  } else if (o.kind === 'hausdach') {
    ctx.fillStyle = '#1b2b49';
    ctx.fillRect(x - b / 2, L.FIELD.groundY - o.h, b, o.h);
    ctx.beginPath();
    ctx.moveTo(x - b / 2 - 7, L.FIELD.groundY - o.h);
    ctx.lineTo(x, L.FIELD.groundY - o.h - 26);
    ctx.lineTo(x + b / 2 + 7, L.FIELD.groundY - o.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';           // Schnee auf dem First
    ctx.fillRect(x - b / 2 - 7, L.FIELD.groundY - o.h - 3, b + 14, 4);
  } else if (o.kind === 'seebuehne') {
    ctx.fillStyle = '#1a2d4d';
    ctx.fillRect(x - b / 2, L.FIELD.groundY - o.h, b, o.h);
    ctx.fillStyle = 'rgba(255,214,120,0.9)';
    for (let i = 0; i * 40 < o.h - 16; i++) ctx.fillRect(x - b / 2 + 4, L.FIELD.groundY - 20 - i * 40, b - 8, 5);
  } else if (o.kind === 'gondel' || o.kind === 'seilbahn') {
    ctx.strokeStyle = '#8e9bb5';                       // Seil
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, o.h - 28);
    ctx.stroke();
    ctx.fillStyle = o.kind === 'gondel' ? '#c0392b' : '#2d6a8f';
    ctx.fillRect(x - b / 2, o.h - 30, b, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x - b / 2 + 5, o.h - 24, b - 10, 13);
  } else if (o.kind === 'eiszapfen') {
    ctx.fillStyle = '#2a3f66';                         // Altstadtbogen
    ctx.fillRect(x - b / 2 - 6, 0, b + 12, 16);
    ctx.fillStyle = 'rgba(214,236,255,0.92)';
    const anzahl = Math.max(3, Math.round(b / 14));
    for (let i = 0; i < anzahl; i++) {
      const zx = x - b / 2 + (i + 0.5) * (b / anzahl);
      const zh = o.h * (0.62 + ((i * 7) % 5) * 0.095);
      ctx.beginPath();
      ctx.moveTo(zx - 5, 14);
      ctx.lineTo(zx, zh);
      ctx.lineTo(zx + 5, 14);
      ctx.closePath();
      ctx.fill();
    }
  } else {                                             // moewe
    ctx.fillStyle = '#eef3fa';
    const anzahl = Math.max(2, Math.round(o.h / 90));
    for (let i = 0; i < anzahl; i++) {
      const my = 30 + (o.h - 40) * (i / Math.max(1, anzahl - 1));
      const mx = x + ((i % 2) * 14 - 7);
      ctx.beginPath();
      ctx.moveTo(mx - 20, my);
      ctx.quadraticCurveTo(mx - 8, my - 11, mx, my - 1);
      ctx.quadraticCurveTo(mx + 8, my - 11, mx + 20, my);
      ctx.quadraticCurveTo(mx, my + 7, mx - 20, my);
      ctx.fill();
    }
  }
}

function geschenk(g, s, t) {
  const x = g.s - s;
  if (x < -40 || x > L.FIELD.w + 40) return;
  const y = g.y + Math.sin(t * 2 + g.s * 0.01) * 3;    // leichtes Schweben
  const r = L.GIFT_R;
  ctx.fillStyle = '#d64545';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = '#f5d76e';                            // Band
  ctx.fillRect(x - 2.5, y - r, 5, r * 2);
  ctx.fillRect(x - r, y - 2.5, r * 2, 5);
  ctx.beginPath();                                      // Schleife
  ctx.arc(x - 4, y - r - 2, 4, 0, Math.PI * 2);
  ctx.arc(x + 4, y - r - 2, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** Muhdolf: eine Kuh, die sich als Rentier verkleidet hat. */
function muhdolf(z) {
  const neigung = Math.max(-0.34, Math.min(0.34, z.vy / 1000));
  ctx.save();
  ctx.translate(L.COW.x, z.cowY);
  ctx.rotate(neigung);
  if (z.invuln > 0 && Math.floor(z.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.4;

  ctx.strokeStyle = '#eef1f7';                          // Schweif
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-26, -2);
  ctx.quadraticCurveTo(-39, -8, -36, 7);
  ctx.stroke();

  ctx.fillStyle = '#e4e9f1';                            // Beine
  [-15, -3, 9].forEach((bx, i) => ctx.fillRect(bx, 11, 6, 11 + (i % 2) * 4));

  ctx.fillStyle = '#2e7d32';                            // Geschenksack
  ctx.beginPath();
  ctx.ellipse(-15, -15, 12, 9, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(-19, -25, 4, 7);

  ctx.fillStyle = '#f8fafd';                            // Koerper
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2f3a';                            // Kuhflecken
  ctx.beginPath();
  ctx.ellipse(-9, -4, 8, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(9, 5, 6, 4.5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c62828';                            // Schal
  ctx.fillRect(12, -4, 10, 7);
  ctx.beginPath();
  ctx.moveTo(14, 3);
  ctx.lineTo(9, 15);
  ctx.lineTo(17, 14);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#8a5a2b';                          // Geweih
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(20, -16); ctx.lineTo(16, -29);
  ctx.moveTo(16, -29); ctx.lineTo(9, -32);
  ctx.moveTo(16, -29); ctx.lineTo(19, -36);
  ctx.moveTo(28, -16); ctx.lineTo(31, -29);
  ctx.moveTo(31, -29); ctx.lineTo(38, -32);
  ctx.moveTo(31, -29); ctx.lineTo(29, -36);
  ctx.stroke();

  ctx.fillStyle = '#f8fafd';                            // Kopf
  ctx.beginPath();
  ctx.ellipse(24, -7, 13, 11, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e4e9f1';                            // Ohr
  ctx.beginPath();
  ctx.ellipse(17, -15, 5, 3.5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c3c9';                            // Schnauze
  ctx.beginPath();
  ctx.ellipse(33, -3, 7, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e03a3a';                            // rote Nase
  ctx.beginPath();
  ctx.arc(37, -4, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242e';                            // Auge
  ctx.beginPath();
  ctx.arc(26, -11, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}
```

- [ ] **Schritt 4: Schneetreiben und die neue Zeichenfunktion einbauen**

```js
// --- Schneetreiben (reine Deko, beruehrt den Spielzustand nicht) ---------

const flocken = [];
for (let i = 0; i < 70; i++) {
  flocken.push({
    x: Math.random() * L.FIELD.w,
    y: Math.random() * L.FIELD.groundY,
    r: 1 + Math.random() * 2.2,
    v: 24 + Math.random() * 54,
  });
}

function schnee(dt) {
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  for (const f of flocken) {
    f.y += f.v * dt;
    f.x -= f.v * 0.5 * dt;
    if (f.y > L.FIELD.groundY) { f.y = -4; f.x = Math.random() * L.FIELD.w; }
    if (f.x < -4) f.x = L.FIELD.w + 4;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Das ganze Bild ------------------------------------------------------

function zeichnen(z, dt) {
  // Beim Etappenwechsel wird eine Sekunde lang uebergeblendet, nicht umgeschaltet.
  const mix = z.bannerLeft > 0 ? Math.min(1, (L.BANNER - z.bannerLeft) / 1) : 1;
  if (mix < 1 && z.stage > 0) {
    kulisse(z.stage - 1, z.s);
    ctx.globalAlpha = mix;
  }
  kulisse(z.stage, z.s);
  ctx.globalAlpha = 1;

  for (const o of z.obstacles) hindernis(o, z.s);
  for (const g of z.gifts) if (!g.taken) geschenk(g, z.s, z.t);
  muhdolf(z);
  schnee(dt);
}
```

- [ ] **Schritt 5: Von Hand prüfen**

`index.html` im Browser öffnen.

Erwartet:
- Bludenz: gestaffelte Bergketten mit Schneekappen, die Zimba als deutliche Spitze, Tannen und die Schokoladefabrik mit Rauchfahne im Vordergrund; die fernen Ketten ziehen langsamer vorbei als die nahen.
- Muhdolf ist als Kuh mit Geweih, roter Nase, Schal und Geschenksack erkennbar und kippt beim Steigen und Sinken.
- Felszacken mit Schneekappe wachsen vom Boden, rote Gondeln hängen an Seilen von oben.
- Nach 35 Sekunden gleitet die Kulisse weich nach Feldkirch über: Schattenburg auf dem Hügel, Katzenturm, Altstadtdächer; hängende Eiszapfen statt Gondeln.
- Nach 70 Sekunden Dornbirn mit dem Roten Haus und der Karren-Seilbahn, nach 105 Sekunden Bregenz mit Martinsturm, Seebühne und Wasser statt Schnee; die Sterne sind verblasst.
- Schneeflocken fallen gleichmäßig, unabhängig von der Bildrate.

- [ ] **Schritt 6: Alle Tests laufen lassen**

Ausführen: `node --test tests/`
Erwartet: ERFOLG, 48 Tests bestanden — am Zeichnen darf sich die Logik nicht geändert haben.

- [ ] **Schritt 7: Commit**

```bash
git add index.html
git commit -m "Vorarlberg-Kulisse, Hindernisse und Muhdolf gezeichnet" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 9: Anzeige, Bildschirme und Rekord

Punkte, Herzen und Stadtname als HTML über dem Canvas; dazu Start-, Ziel- und Absturzbildschirm. Der Endbildschirm ist der eigentliche Zweck der Seite — er trägt die Botschaft und muss vollständig auf einen Screenshot passen.

**Dateien:**
- Ändern: `index.html` — `<style>`, der Körper, Block `game-app`

- [ ] **Schritt 1: Aufbau und Stil einbauen**

Im `<body>` direkt nach `<div id="buehne">…</div>` einfügen:

```html
<div id="hud" hidden>
  <div id="punkte">0</div>
  <div id="stadt"></div>
  <div id="herzen"></div>
</div>

<div id="schirm">
  <section id="start" class="karte">
    <h1>Muhdolfs Geschenke-Flug</h1>
    <p class="unter">Von Bludenz nach Bregenz</p>
    <p class="anleitung">
      <strong>Halten</strong> zum Steigen &mdash; <strong>loslassen</strong> zum Sinken.<br>
      Finger, Maustaste oder Leertaste.
    </p>
    <p class="anleitung">Geschenke einsammeln, Bergen und Dächern ausweichen. Drei Herzen.</p>
    <p id="rekordzeile" class="klein" hidden></p>
    <p id="drehhinweis" class="klein" hidden>Im Querformat fliegt es sich schöner &mdash; dreh das Handy einmal.</p>
    <button id="losButton" type="button">Losfliegen</button>
  </section>

  <section id="pause" class="karte" hidden>
    <h2>Pause</h2>
    <p class="anleitung">Tippen oder Leertaste, und es geht weiter.</p>
    <button id="weiterButton" type="button">Weiterfliegen</button>
  </section>

  <section id="ende" class="karte" hidden>
    <p id="endeTitel" class="unter"></p>
    <p id="endePunkte"><strong>0</strong> <span>von 5200</span></p>
    <ul id="endeDetails"></ul>
    <p id="botschaft">Frohe Weihnachten wünschen Mona und Michi</p>
    <button id="nochmalButton" type="button">Nochmal fliegen</button>
  </section>
</div>
```

Im `<style>` ergänzen:

```css
  #hud {
    position: fixed; inset: 0 0 auto 0; display: flex; align-items: center;
    justify-content: space-between; gap: 12px;
    padding: max(10px, env(safe-area-inset-top)) 16px 10px;
    font-variant-numeric: tabular-nums; pointer-events: none;
    text-shadow: 0 1px 4px rgba(0,0,0,0.65);
  }
  #punkte { font-size: clamp(20px, 5vw, 30px); font-weight: 700; }
  #stadt { font-size: clamp(13px, 3.4vw, 18px); letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.9; }
  #herzen { font-size: clamp(16px, 4.4vw, 24px); color: #ff6b6b; }

  #schirm { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; }
  #schirm[hidden] { display: none; }
  .karte {
    width: min(460px, 100%); max-height: 100%; overflow: auto;
    padding: clamp(18px, 5vw, 32px); border-radius: 18px; text-align: center;
    background: rgba(10, 20, 40, 0.93);
    border: 1px solid rgba(255,255,255,0.14);
    box-shadow: 0 18px 50px rgba(0,0,0,0.5);
  }
  .karte h1 { margin: 0 0 4px; font-size: clamp(22px, 6.4vw, 34px); line-height: 1.15; }
  .karte h2 { margin: 0 0 8px; font-size: clamp(20px, 5.4vw, 26px); }
  .unter { margin: 0 0 14px; opacity: 0.75; font-size: clamp(13px, 3.6vw, 16px); }
  .anleitung { margin: 10px 0; font-size: clamp(13px, 3.6vw, 16px); line-height: 1.5; opacity: 0.92; }
  .klein { margin: 10px 0 0; font-size: clamp(12px, 3.2vw, 14px); opacity: 0.7; }

  #endePunkte { margin: 6px 0 14px; }
  #endePunkte strong { font-size: clamp(38px, 12vw, 64px); font-weight: 800; letter-spacing: -0.02em; }
  #endePunkte span { font-size: clamp(13px, 3.6vw, 16px); opacity: 0.65; }
  #endeDetails {
    margin: 0 0 16px; padding: 0; list-style: none; display: grid; gap: 6px;
    font-size: clamp(13px, 3.6vw, 16px);
  }
  #endeDetails li { display: flex; justify-content: space-between; gap: 16px; opacity: 0.9; }
  #endeDetails b { font-variant-numeric: tabular-nums; }

  #botschaft {
    margin: 18px 0 20px; padding: 14px 10px; border-radius: 12px;
    font-size: clamp(17px, 5vw, 24px); font-weight: 700; line-height: 1.35;
    background: linear-gradient(135deg, rgba(198,40,40,0.3), rgba(46,125,50,0.3));
    border: 1px solid rgba(255,255,255,0.18);
  }

  button {
    appearance: none; cursor: pointer; font: inherit; font-weight: 700;
    padding: 14px 26px; min-height: 48px; border-radius: 999px; border: 0;
    color: #16233d; background: linear-gradient(180deg, #ffe08a, #e9b949);
    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
  }
  button:active { transform: translateY(1px); }
```

- [ ] **Schritt 2: Anzeige, Bildschirme und Rekord einbauen**

Am Ende des Blocks `game-app` einfügen:

```js
// --- Anzeige und Bildschirme --------------------------------------------

const hud = document.getElementById('hud');
const schirm = document.getElementById('schirm');
const elPunkte = document.getElementById('punkte');
const elStadt = document.getElementById('stadt');
const elHerzen = document.getElementById('herzen');
const schirmStart = document.getElementById('start');
const schirmPause = document.getElementById('pause');
const schirmEnde = document.getElementById('ende');
const elRekordzeile = document.getElementById('rekordzeile');
const elDrehhinweis = document.getElementById('drehhinweis');
const elEndeTitel = document.getElementById('endeTitel');
const elEndePunkte = document.querySelector('#endePunkte strong');
const elEndeMax = document.querySelector('#endePunkte span');
const elEndeDetails = document.getElementById('endeDetails');

const REKORD_SCHLUESSEL = 'muhdolf.rekord';

/** Liest den Rekord. Im Privat-Modus ist der Speicher gesperrt -- dann eben 0. */
function rekordLesen() {
  try {
    const n = parseInt(window.localStorage.getItem(REKORD_SCHLUESSEL), 10);
    return Number.isFinite(n) && n >= 0 && n <= L.SCORE.max ? n : 0;
  } catch (fehler) {
    return 0;
  }
}

function rekordSchreiben(punkte) {
  try {
    window.localStorage.setItem(REKORD_SCHLUESSEL, String(punkte));
  } catch (fehler) {
    /* gesperrt oder voll: das Spiel laeuft trotzdem weiter */
  }
}

function zeigen(abschnitt) {
  for (const s of [schirmStart, schirmPause, schirmEnde]) s.hidden = s !== abschnitt;
  schirm.hidden = abschnitt === null;
  hud.hidden = abschnitt !== null && abschnitt !== schirmPause;
}

function hudAktualisieren(z) {
  elPunkte.textContent = z.score;
  elStadt.textContent = z.bannerLeft > 0 ? L.STAGES[z.stage].name : '';
  elHerzen.textContent = '♥'.repeat(z.hearts) + '♡'.repeat(L.HEARTS - z.hearts);
}

function startbildschirm() {
  const rekord = rekordLesen();
  elRekordzeile.hidden = rekord === 0;
  elRekordzeile.textContent = `Dein Rekord: ${rekord} von ${L.SCORE.max} Punkten`;
  elDrehhinweis.hidden = window.innerWidth >= window.innerHeight;
  zeigen(schirmStart);
}

/** Der Endbildschirm: alles, was man vergleichen will, auf einem Blick. */
function flugBeendet() {
  const z = zustand;
  const geschafft = z.phase === 'ziel';
  const rekordVorher = rekordLesen();
  if (z.score > rekordVorher) rekordSchreiben(z.score);

  elEndeTitel.textContent = geschafft
    ? 'Bregenz erreicht — die Geschenke sind zugestellt.'
    : `Abgestürzt in ${L.STAGES[z.stage].name}.`;
  elEndePunkte.textContent = z.score;
  elEndeMax.textContent = `von ${L.SCORE.max}`;

  const zeilen = [
    ['Geschenke', `${z.giftsTaken} von ${L.GIFT_TOTAL}`],
    ['Herzen übrig', `${z.hearts} von ${L.HEARTS}`],
    ['Weit gekommen bis', geschafft ? 'Bregenz' : L.STAGES[z.stage].name],
    ['Dein Rekord', `${Math.max(rekordVorher, z.score)}`],
  ];
  if (z.score > rekordVorher && rekordVorher > 0) zeilen.push(['', 'Neuer Rekord!']);
  elEndeDetails.innerHTML = '';
  for (const [name, wert] of zeilen) {
    const li = document.createElement('li');
    const links = document.createElement('span');
    links.textContent = name;
    const rechts = document.createElement('b');
    rechts.textContent = wert;
    li.append(links, rechts);
    elEndeDetails.append(li);
  }
  zeigen(schirmEnde);
}

function losfliegen() {
  zustand = L.createState();
  akku = 0;
  letzterRahmen = 0;
  auftrieb = false;
  pausiert = false;
  laeuft = true;
  zeigen(null);
}

document.getElementById('losButton').addEventListener('click', losfliegen);
document.getElementById('nochmalButton').addEventListener('click', losfliegen);
document.getElementById('weiterButton').addEventListener('click', () => {
  pausiert = false;
  letzterRahmen = 0;
  zeigen(null);
});

startbildschirm();
```

- [ ] **Schritt 3: Die Schleife an die Bildschirme anschließen**

In `rahmen` die Zeile

```js
    if (zustand.phase !== 'fliegt') laeuft = false;
```

ersetzen durch:

```js
    if (zustand.phase !== 'fliegt') {
      laeuft = false;
      flugBeendet();
    }
```

Und am Ende von `rahmen`, nach `zeichnen(zustand, dt);`, ergänzen:

```js
  hudAktualisieren(zustand);
```

Außerdem die vorläufige Zeile `laeuft = true;` aus Aufgabe 7 löschen — jetzt startet der Knopf.

- [ ] **Schritt 4: Von Hand prüfen**

`index.html` im Browser öffnen.

Erwartet:
- Der Startbildschirm steht über der Kulisse, „Losfliegen" startet. Die Rekordzeile fehlt beim ersten Mal und erscheint ab dem zweiten Durchgang.
- Im Flug stehen oben links die Punkte, oben rechts drei Herzen; nach einem Treffer wird ein Herz leer.
- Beim Etappenwechsel steht der Stadtname zwei Sekunden oben in der Mitte.
- Nach dem Absturz zeigt der Endbildschirm Titel, Punkte, „von 5200", die vier Zeilen und die Botschaft; „Nochmal fliegen" startet neu.
- Ein Klick auf einen Knopf löst keinen Auftrieb aus.
- Im Hochformat (Fenster schmal ziehen) passt der Endbildschirm ohne Scrollen ins Bild und der Drehhinweis erscheint.
- Rekord bleibt nach dem Neuladen erhalten.

- [ ] **Schritt 5: Commit**

```bash
git add index.html
git commit -m "Anzeige, Start- und Endbildschirm mit der Weihnachtsbotschaft" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 10: Pause, Drehung und der Fall, dass nichts läuft

Die Botschaft muss auch dann ankommen, wenn das Spiel nicht läuft. Und ein Anruf mitten im Flug darf keine Runde kosten.

**Dateien:**
- Ändern: `index.html` — Körper, `<style>`, Block `game-app`

- [ ] **Schritt 1: Den Rückfall in den Körper einbauen**

Direkt nach `<div id="schirm">…</div>` einfügen:

```html
<div id="rueckfall" hidden>
  <div class="karte">
    <h2>Muhdolfs Geschenke-Flug</h2>
    <p class="anleitung">Dieser Browser kann das Spiel leider nicht zeichnen. Die Hauptsache geht aber auch so:</p>
    <p id="botschaftRueckfall">Frohe Weihnachten wünschen Mona und Michi</p>
  </div>
</div>
```

Im `<style>` ergänzen:

```css
  #rueckfall { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; }
  #rueckfall[hidden] { display: none; }
  #botschaftRueckfall {
    margin: 16px 0 0; font-size: clamp(17px, 5vw, 24px); font-weight: 700;
  }
```

- [ ] **Schritt 2: Pause, Neuvermessung und Rückfall einbauen**

Im Block `game-app` die Zeile `const ctx = canvas.getContext('2d');` ersetzen durch:

```js
const ctx = canvas.getContext && canvas.getContext('2d');
if (!ctx) {
  // Kein Canvas: Spiel verbergen, Botschaft zeigen. Sie ist der Zweck der Seite.
  document.getElementById('buehne').hidden = true;
  document.getElementById('schirm').hidden = true;
  document.getElementById('rueckfall').hidden = false;
  throw new Error('Canvas 2D steht nicht zur Verfuegung');
}
```

Am Ende des Blocks `game-app` einfügen:

```js
// --- Pause und Neuvermessung --------------------------------------------

/** Pausiert einen laufenden Flug, wenn das Fenster in den Hintergrund geht. */
function pausieren() {
  if (!laeuft || pausiert || zustand.phase !== 'fliegt') return;
  pausiert = true;
  auftrieb = false;
  akku = 0;
  zeigen(schirmPause);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pausieren();
});
window.addEventListener('pagehide', pausieren);

// Drehung und Groessenaenderung: neu vermessen und pausieren statt abbrechen.
window.addEventListener('resize', () => {
  vermessen();
  elDrehhinweis.hidden = window.innerWidth >= window.innerHeight;
  pausieren();
});

// Aus der Pause heraus geht es auf Tippen oder Leertaste weiter.
window.addEventListener('pointerdown', (e) => {
  if (pausiert && !(e.target.closest && e.target.closest('button'))) {
    pausiert = false;
    letzterRahmen = 0;
    zeigen(null);
  }
});
window.addEventListener('keydown', (e) => {
  if (pausiert && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter')) {
    pausiert = false;
    letzterRahmen = 0;
    zeigen(null);
  }
});
```

Der bestehende `resize`-Aufruf aus Aufgabe 7 (`window.addEventListener('resize', vermessen);`) wird dadurch überflüssig und ist zu löschen — sonst wird zweimal vermessen.

- [ ] **Schritt 3: Von Hand prüfen**

- Im Flug den Tab wechseln und zurückkommen: Das Spiel steht auf Pause, Muhdolf ist nicht abgestürzt, und nach dem Fortsetzen springt sie nicht durch Hindernisse.
- Fenster im Flug verkleinern: Pause, Feld neu skaliert, Weiterfliegen funktioniert.
- Auf dem Handy im Flug drehen: dasselbe.
- Im privaten Fenster spielen: Spiel läuft, es erscheint keine Fehlermeldung, nur die Rekordzeile bleibt weg.
- Rückfall prüfen: In der Konsole `document.getElementById('rueckfall').hidden = false` ausführen — die Karte mit der Botschaft erscheint und ist lesbar.

- [ ] **Schritt 4: Alle Tests laufen lassen und committen**

```bash
node --test tests/
git add index.html
git commit -m "Pause bei Tab-Wechsel und Drehung, Rueckfall ohne Canvas" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Erwartet: 48 Tests bestanden.

---

## Aufgabe 11: Spieltest und Feinjustierung

Die Zahlen in der Spezifikation sind Startwerte. Jetzt wird gespielt, und zwar auf einem echten Handy — nicht nur im schmalen Browserfenster.

**Dateien:**
- Anlegen: `tools/serve.md`
- Ändern: `index.html` (nur Zahlenwerte)

- [ ] **Schritt 1: Kurzanleitung für den Test im Heimnetz anlegen**

`tools/serve.md`:

```markdown
# Auf dem Handy testen, bevor es online geht

Im Projektordner einen kleinen Webserver starten:

    python -m http.server 8000

Die IP-Adresse des Rechners herausfinden (Windows):

    ipconfig

Dann am Handy im gleichen WLAN im Browser aufrufen:

    http://<IP-Adresse>:8000/

Beenden mit Strg+C. Das ist nur fuer den Test -- ausgeliefert wird spaeter
ueber GitHub Pages.
```

- [ ] **Schritt 2: Die Prüfliste durchspielen**

Auf dem Handy (Querformat **und** Hochformat) und am Laptop:

- [ ] Eine Runde ohne Üben: Wird Bregenz erreicht? Falls nicht, ist die Strecke zu schwer.
- [ ] Fühlt sich der Flug ruhig an, oder ist er zappelig? Zu zappelig → `PHYS.lift` und `PHYS.gravity` gemeinsam senken (Verhältnis beibehalten). Zu träge → beide erhöhen.
- [ ] Ist Muhdolf steuerbar, ohne dass man die Decke als Dauerparkplatz nutzen kann? Falls doch: in `obstacleRange` die Mindesthöhe der Deckenhindernisse erhöhen.
- [ ] Reicht die Vorwarnzeit in Bregenz (Querungszeit 3,0 s) noch? Falls nicht, in `STAGES` auf 3,2 oder 3,4 anheben.
- [ ] Wie viele Geschenke holt man beim ersten Mal? Ziel sind 25 bis 35 von 50. Deutlich mehr → in `gruppeSetzen` den Anteil `bequem` senken, indem im Feld `klassen` ein `bequem` durch `riskant` ersetzt wird. Deutlich weniger → umgekehrt.
- [ ] Punkte beim ersten Durchkommen zwischen 2200 und 2600?
- [ ] Sind alle vier Städte als Kulisse erkennbar?
- [ ] Läuft das Spiel auf dem Handy gleich schnell wie am Laptop? (Beide gleichzeitig starten und nach einer Minute die Flugzeit vergleichen.)

- [ ] **Schritt 3: Nach jeder Änderung an Zahlenwerten die Tests laufen lassen**

Ausführen: `node --test tests/`
Erwartet: 48 Tests bestanden. Schlägt `tests/strecke.test.mjs` fehl, ist die Strecke durch die Änderung unfair geworden — Wert zurücknehmen oder `SEED` wechseln und erneut spielen.

- [ ] **Schritt 4: Commit**

```bash
git add index.html tools/serve.md
git commit -m "Flugphysik und Streckenschwierigkeit nach dem Spieltest justiert" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Aufgabe 12: Veröffentlichen und QR-Code

**Dateien:**
- Anlegen: `tools/qr.py`
- Anlegen: `README.md`

- [ ] **Schritt 1: Auf GitHub veröffentlichen**

Diese Schritte braucht ein GitHub-Konto und muss der Benutzer selbst bestätigen — Repository-Name und Konto gehören ihm.

```bash
gh auth status
gh repo create muhdolf --public --source=. --remote=origin --push
```

Steht `gh` nicht bereit: Repository über die Weboberfläche anlegen, dann

```bash
git remote add origin https://github.com/<benutzer>/muhdolf.git
git push -u origin main
```

Danach Pages einschalten:

```bash
gh api -X POST repos/<benutzer>/muhdolf/pages -f "source[branch]=main" -f "source[path]=/"
```

Oder im Browser: *Settings → Pages → Source: Deploy from a branch → main / (root)*.

Die Seite liegt dann unter `https://<benutzer>.github.io/muhdolf/`. Die erste Veröffentlichung braucht ein bis zwei Minuten.

- [ ] **Schritt 2: Die veröffentlichte Seite prüfen**

- [ ] URL am Laptop öffnen: Spiel startet.
- [ ] URL am Handy über Mobilfunk öffnen (nicht WLAN): Ladezeit unter einer Sekunde, Spiel startet.
- [ ] Eine Runde zu Ende spielen und einen Screenshot machen: Ist alles lesbar?

- [ ] **Schritt 3: Das QR-Werkzeug anlegen**

`tools/qr.py`:

```python
"""Erzeugt den QR-Code fuer Muhdolfs Geschenke-Flug.

Aufruf:
    python tools/qr.py https://<benutzer>.github.io/muhdolf/

Ergebnis:
    qr/muhdolf.png  -- fuer Word, Mail und schnellen Druck
    qr/muhdolf.svg  -- verlustfrei skalierbar, fuer die Druckerei

Einmalig installieren, falls noch nicht vorhanden:
    python -m pip install "qrcode[pil]"
"""
import pathlib
import sys

try:
    import qrcode
    import qrcode.image.svg
except ModuleNotFoundError:
    sys.exit('Fehlt noch:  python -m pip install "qrcode[pil]"')


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit('Aufruf: python tools/qr.py <URL>')
    url = sys.argv[1].strip()
    if not url.startswith(('http://', 'https://')):
        sys.exit('Die URL muss mit http:// oder https:// beginnen.')

    ziel = pathlib.Path('qr')
    ziel.mkdir(exist_ok=True)

    # Fehlerkorrektur Q vertraegt auf Papier auch einen Knick oder Fleck.
    stufe = qrcode.constants.ERROR_CORRECT_Q

    png = qrcode.QRCode(error_correction=stufe, box_size=12, border=4)
    png.add_data(url)
    png.make(fit=True)
    png.make_image(fill_color='black', back_color='white').save(ziel / 'muhdolf.png')

    svg = qrcode.QRCode(error_correction=stufe, box_size=12, border=4,
                        image_factory=qrcode.image.svg.SvgPathImage)
    svg.add_data(url)
    svg.make(fit=True)
    svg.make_image().save(str(ziel / 'muhdolf.svg'))

    print(f'QR-Code fuer {url} liegt in {ziel.resolve()}')
    print('Vor dem Druck mit einem echten Handy pruefen.')


if __name__ == '__main__':
    main()
```

- [ ] **Schritt 4: QR-Code erzeugen und prüfen**

```bash
python -m pip install "qrcode[pil]"
python tools/qr.py https://<benutzer>.github.io/muhdolf/
```

Erwartet: Zwei Dateien in `qr/`, die Meldung mit dem Pfad.

- [ ] Mit einem echten Handy scannen: Das Spiel öffnet sich.
- [ ] Den PNG auf Kartengröße (etwa 3 cm) ausdrucken und erneut scannen — kleiner Druck ist der häufigste Grund, warum ein QR-Code auf einer Weihnachtskarte nicht funktioniert.

- [ ] **Schritt 5: README anlegen**

`README.md`:

```markdown
# Muhdolfs Geschenke-Flug

Ein Weihnachtsgruss von Mona und Michi als kleines Browserspiel. Muhdolf, eine
Kuh im Rentierkostuem, fliegt von Bludenz das Rheintal hinunter nach Bregenz.

Spielen: https://<benutzer>.github.io/muhdolf/

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | das ganze Spiel -- eine Datei, keine Abhaengigkeiten |
| `tests/` | Tests der Spiellogik (`node --test tests/`) |
| `tools/qr.py` | erzeugt den QR-Code aus der URL |
| `docs/superpowers/` | Spezifikation und Umsetzungsplan |

## Entwickeln

Spiel oeffnen: `index.html` doppelklicken. Tests: `node --test tests/`.
Auf dem Handy testen: siehe `tools/serve.md`.

Die Spiellogik steht im Script-Block `game-logic` und beruehrt weder DOM noch
Uhr noch Zufall -- deshalb laesst sie sich in Node testen und laeuft auf jedem
Geraet gleich. Die Strecke wird aus einem festen Keim berechnet: Alle fliegen
dieselbe Runde, damit die Punktzahlen vergleichbar sind.
```

- [ ] **Schritt 6: Commit und veröffentlichen**

```bash
git add tools/qr.py README.md qr/
git commit -m "QR-Code-Werkzeug und README" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

- [ ] **Schritt 7: Letzter Durchgang auf der echten Seite**

- [ ] Nach dem Push eine Minute warten, Seite neu laden, eine Runde spielen.
- [ ] Den QR-Code jemandem geben, der das Spiel nicht kennt, und zusehen, ohne zu helfen. Kommt die Person vom Scan bis zum Flug? Erreicht sie Bregenz? Das ist die eigentliche Abnahme.

---

## Abschluss

Nach Aufgabe 12 ist alles aus der Spezifikation umgesetzt. Was offen bleibt, gehört dem Benutzer:

- Die Weihnachtskarte selbst, mit dem QR-Code aus `qr/`.
- Die Entscheidung, ob die URL kürzer sein soll (eigene Domain statt `github.io`).

Vor dem Verschicken: `superpowers:verification-before-completion` durchgehen — alle Tests laufen lassen, die veröffentlichte Seite auf einem echten Handy über Mobilfunk öffnen, eine Runde zu Ende spielen.
