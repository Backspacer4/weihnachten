# Muhdolfs Geschenke-Flug

Ein Weihnachtsgruss von Mona und Michi als kleines Browserspiel. Muhdolf, eine
Kuh im Rentierkostuem, fliegt von Bludenz das Rheintal hinunter nach Bregenz --
vier Etappen, 50 Geschenke, drei Herzen.

Spielen: https://backspacer4.github.io/weihnachten/

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | das ganze Spiel -- eine Datei, keine Abhaengigkeiten, 64 KB |
| `tests/` | Tests der Spiellogik (`node --test tests/`) |
| `tools/erreichbarkeit.mjs` | beweist, dass die 5200 Punkte erreichbar sind |
| `tools/qr.py` | erzeugt den QR-Code aus der URL |
| `tools/serve.md` | wie man im Heimnetz auf dem Handy testet |
| `docs/superpowers/` | Spezifikation und Umsetzungsplan |

## Entwickeln

Spiel oeffnen: `index.html` doppelklicken, es braucht keinen Webserver.

    node --test tests/              # 57 Tests der Spiellogik
    node tools/erreichbarkeit.mjs   # Nachweis, dass 5200 Punkte moeglich sind

Die Spiellogik steht im Script-Block `game-logic` und beruehrt weder DOM noch
Uhr noch Zufall -- deshalb laesst sie sich in Node testen und laeuft auf jedem
Geraet gleich. Die Strecke wird aus einem festen Keim berechnet: Alle fliegen
dieselbe Runde, damit die Punktzahlen vergleichbar sind.

**Wer an der Schwierigkeit dreht** (`SEED`, `obstacleRange`, `GIFT_SPACING`,
Hindernisabstand, Flugphysik), muss **beides** laufen lassen. Die Tests pruefen
einzelne Eigenschaften der Strecke; nur die Erreichbarkeitssuche beantwortet,
ob eine Runde wirklich alle 50 Geschenke ohne Treffer holen kann. Auf dem
Endbildschirm steht "von 5200" -- diese Zahl muss stimmen.
