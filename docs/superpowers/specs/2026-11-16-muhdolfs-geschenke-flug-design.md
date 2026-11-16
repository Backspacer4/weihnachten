# Muhdolfs Geschenke-Flug — Design

**Datum:** 2026-11-16
**Status:** freigegeben

## Zweck

Ein Weihnachtsgruß von Mona und Michi, der als kleines Browserspiel verschickt wird.
Empfänger scannen einen QR-Code auf einer Karte oder tippen eine kurze URL am Laptop ein.
Das Spiel startet sofort im Browser — ohne Installation, ohne Login, ohne Datenerfassung.

Erfolgskriterien:

1. Ein Laie kommt vom Scan bis zum laufenden Spiel ohne Hilfe und ohne Rückfrage.
2. Das Spiel ist auf Handy und Laptop gleich gut spielbar und läuft überall gleich schnell.
3. Auch jemand, der zum ersten Mal ein solches Spiel spielt, erreicht Bregenz.
4. Niemand verpasst die Weihnachtsbotschaft, auch wer das Ziel nie erreicht.

Nicht-Ziele: Mehrspieler, globale Rangliste, Benutzerkonten, Tonspur, App-Store-Version.

## Das Spiel

Muhdolf — eine Kuh im Rentierkostüm — fliegt mit Geschenken von Bludenz das Rheintal
hinunter nach Bregenz. Vier Etappen, zusammen gut zwei Minuten. Unterwegs
sammelt sie Geschenke und weicht Hindernissen aus. Am Bodensee wartet die Botschaft.

### Figur

Gezeichnete Kuh in Seitenansicht: weißer Körper mit schwarzen Flecken, aufgesetztes
Geweih-Stirnband, rote Nase, roter Schal, kleine flatternde Ohren. Keine Bilddateien —
alles aus Canvas-Pfaden. Im Flug kippt sie leicht nach oben oder unten, je nach
Steigrichtung; das zeigt dem Spieler ohne Worte, was seine Eingabe bewirkt.

### Steuerung

Ein einziger Eingabebefehl, "Auftrieb", ausgelöst von allen Quellen gleichwertig:

| Quelle | Aktion |
|---|---|
| Touch | Finger auf dem Spielfeld halten |
| Maus | linke Taste halten |
| Tastatur | Leertaste oder Pfeil-oben halten |

Gedrückt halten lässt Muhdolf steigen, loslassen sinken. Es gibt keine Sprung-Impulse
und keinen Flattermechanismus — der Flug soll ruhig steuerbar sein, nicht hektisch.
Alle Quellen setzen dasselbe Flag; die Spiellogik kennt nur dieses Flag und nicht,
woher es kam. Mehrere gleichzeitige Eingaben sind kein Sonderfall.

Die Leertaste darf die Seite nicht scrollen (`preventDefault`), und ein Touch darf
weder Wischgesten noch Doppeltipp-Zoom auslösen (`touch-action: none`).

### Spielfeld und Maßstab

Die Spiellogik rechnet in logischen Einheiten, unabhängig von der Bildschirmgröße:

- Logische Höhe: fest **540** Einheiten.
- Logische Breite: `clamp(round(540 × Seitenverhältnis), 400, 1280)`.
- Das Canvas füllt das Browserfenster; gezeichnet wird mit
  `devicePixelRatio`-Skalierung, damit nichts unscharf wird.

Ein Hochformat-Handy bekommt damit ein hohes, schmales Feld, ein Laptop ein breites.
Weil ein schmales Feld weniger Vorwarnzeit gibt, wird die Scrollgeschwindigkeit an die
Breite gekoppelt: Ein Hindernis braucht **immer gleich lange** von rechts bis zu
Muhdolf, egal wie breit das Feld ist. Geschwindigkeit = Breite ÷ Querungszeit.

Bei Größenänderung oder Drehung des Geräts wird neu vermessen und neu skaliert; ein
laufendes Spiel pausiert dabei statt abzubrechen.

### Physik

Feste Schrittweite von 1/120 Sekunde mit Akkumulator, maximal 5 Schritte pro Bild.
Ohne das läuft das Spiel auf einem 120-Hz-Handy doppelt so schnell wie auf einem
60-Hz-Laptop. Die Obergrenze verhindert, dass das Spiel nach einer Pause die
aufgelaufene Zeit in einem Rutsch nachrechnet und Muhdolf durch Hindernisse springt.

Startwerte (in logischen Einheiten pro Sekunde; beim Spieltest nachjustierbar):

| Größe | Wert |
|---|---|
| Schwerkraft | 1400 /s² |
| Auftrieb (gehalten) | 2600 /s² nach oben |
| maximale Sinkgeschwindigkeit | 700 /s |
| maximale Steiggeschwindigkeit | 600 /s |
| Muhdolfs x-Position | 18 % der Feldbreite |
| Trefferfläche Muhdolf | 56 × 40 Einheiten |
| Querungszeit Etappe 1 → 4 | 4,5 s → 3,0 s (linear) |

Oben stößt Muhdolf an eine unsichtbare Decke und wird dort festgehalten — ohne Strafe.
Bodenkontakt kostet ein Herz. Damit die Decke kein sicherer Hafen ist, hängen
Hindernisse abwechselnd am Boden und von oben herab (Gondeln, Seilbahnkabinen, Möwen).
Aufeinanderfolgende Hindernisse lassen immer eine Lücke von mindestens
3,2 × Muhdolfs Höhe — eine Strecke, die niemand schaffen kann, darf nicht entstehen.

Trefferflächen sind achsenparallele Rechtecke, auf 80 % der sichtbaren Größe
geschrumpft. Spieler verzeihen einen knapp verpassten Treffer leichter als einen
Treffer, den sie optisch für einen Beinahe-Vorbeiflug halten.

### Etappen

Jede Etappe dauert 35 Sekunden Flugzeit, insgesamt 140 Sekunden.

| Etappe | Kulisse (Silhouetten im Hintergrund) | Hindernisse |
|---|---|---|
| Bludenz | Bergkette, Schokoladefabrik, Burg Gayenhofen | Felszacken vom Boden, Seilbahngondeln von oben |
| Feldkirch | Schattenburg, Katzenturm, Altstadtdächer | Burgtürme, Kirchturmspitze, Dachgiebel |
| Dornbirn | Rotes Haus, Marktplatz, Karrenseilbahn | Hausdächer, Seilbahnkabinen von oben |
| Bregenz | Martinsturm, Seebühne, Pfänder, Bodensee | Seebühnen-Aufbauten, Möwen von oben |

Die Reihenfolge folgt der Geografie von Süd nach Nord: aus den Bergen ins flache
Rheintal zum See. Entsprechend sinkt die Horizontlinie von Etappe zu Etappe, und in
Bregenz liegt unten Wasser statt Schnee. Der Hintergrund scrollt langsamer als die
Hindernisse (Parallaxe), was Tiefe erzeugt.

Beim Etappenwechsel wird der Stadtname zwei Sekunden lang eingeblendet, während das
Spiel weiterläuft. Der Hintergrund wird über eine Sekunde übergeblendet, nicht
umgeschaltet. Während der Einblendung werden keine neuen Hindernisse erzeugt, damit
der Spieler nicht von einem Hindernis getroffen wird, das er hinter der Schrift
nicht gesehen hat.

### Punkte, Geschenke, Herzen

- Geflogene Zeit: 10 Punkte je Sekunde. Nicht die zurückgelegte Strecke — die
  hängt an der Feldbreite, und ein Breitbild-Laptop soll keine höheren Punktzahlen
  liefern als ein Handy.
- Eingesammeltes Geschenk: 50 Punkte. Geschenke erscheinen alle 1,2 bis 2,2 Sekunden
  an zufälliger Höhe, nie innerhalb eines Hindernisses.
- Ziel erreicht: 500 Punkte, zusätzlich 100 je verbleibendem Herz.
- Drei Herzen. Ein Treffer kostet ein Herz; der dritte Treffer beendet das Spiel.
  Nach einem Treffer wird Muhdolfs Fallgeschwindigkeit auf null gesetzt und sie
  leicht über die Trefferstelle versetzt, damit sie nicht im selben Hindernis hängen
  bleibt. Danach folgen 1,5 Sekunden Unverwundbarkeit, in denen sie blinkt und
  normal weitergesteuert wird.

Die Punktzahl steht oben links, die Herzen oben rechts, die aktuelle Stadt oben Mitte.

## Bildschirme

**Start.** Titel "Muhdolfs Geschenke-Flug", Muhdolf schwebt über einer
Vorarlberg-Winterkulisse, ein Satz Anleitung ("Halten zum Steigen — loslassen zum
Sinken"), darunter "Tippen zum Starten". Ist ein Rekord gespeichert, steht er klein
darunter.

**Spiel.** Siehe oben.

**Ziel erreicht.** Bodensee-Panorama, Muhdolf landet. Punktzahl, Rekord, und groß:

> Frohe Weihnachten wünschen Mona und Michi

Darunter "Nochmal fliegen".

**Abgestürzt.** Dieselbe Botschaft, nur unaufgeregt gesetzt: erreichte Stadt,
Punktzahl, Rekord, "Nochmal fliegen". Wer in Dornbirn an einem Dach hängen bleibt,
soll den Gruß trotzdem lesen — das ist der eigentliche Zweck der Seite.

**Pause.** Wird das Fenster verlassen, pausiert das Spiel sichtbar und wartet auf eine
Eingabe. Ein Anruf mitten im Flug darf keine Runde kosten.

## Technik

Eine einzige Datei `index.html` mit allem darin: Aufbau, Stil, Logik. Keine
Bibliotheken, keine Bilddateien, keine Schriftarten, keine Netzwerkzugriffe zur
Laufzeit. Gründe:

- Lädt auch über schlechtes Mobilfunknetz in unter einer Sekunde.
- Funktioniert nach dem ersten Laden offline und per Doppelklick ohne Webserver.
- Das Hosting bleibt austauschbar: eine Datei hochladen, fertig.
- Nichts kann durch einen abgeschalteten Fremddienst kaputtgehen.

Grafik: Canvas 2D, alles aus Pfaden gezeichnet. Textanzeigen ebenfalls im Canvas,
damit Spielfeld und Anzeige nicht auseinanderlaufen. Systemschriften.

### Innerer Aufbau

Innerhalb der Datei klar getrennte Abschnitte mit je einer Aufgabe:

| Abschnitt | Aufgabe | Kennt |
|---|---|---|
| `logic` | reine Spiellogik: Physik, Kollision, Punkte, Erzeugung von Hindernissen und Geschenken, Etappenfortschritt | nichts von Canvas, DOM oder Zeit |
| `render` | zeichnet einen Zustand | liest den Zustand, ändert ihn nie |
| `input` | sammelt alle Eingabequellen zu einem Flag | nichts von Physik |
| `loop` | feste Schrittweite, ruft `logic` und `render` | — |
| `storage` | Rekord lesen und schreiben | nichts vom Spiel |
| `screens` | Start, Spiel, Ziel, Absturz, Pause | ruft die übrigen |

`logic` ist der Kern und besteht aus Funktionen der Form
`(zustand, eingabe, zeitschritt) → neuer zustand`. Diese Funktionen sind ohne Browser
prüfbar — genau deshalb liegen sie getrennt. `render` darf den Zustand nicht
verändern; sonst hängt das Spielverhalten an der Bildrate.

### Tests

`logic` steckt in einem eindeutig markierten Script-Block
(`<script id="game-logic">`). Die Tests unter `tests/` lesen `index.html`, schneiden
diesen Block heraus und prüfen ihn in Node (`node --test`, Node 20 ist vorhanden,
keine Abhängigkeiten). Geprüft wird:

- Physik: Auftrieb lässt steigen, Schwerkraft sinken, Höchstgeschwindigkeiten greifen,
  die Decke hält.
- Determinismus: dieselbe Eingabefolge ergibt denselben Zustand — die Grundlage
  dafür, dass das Spiel auf jedem Gerät gleich läuft.
- Kollision: Treffer wird erkannt, Beinahe-Vorbeiflug nicht, Unverwundbarkeit schützt.
- Herzen: drei Treffer beenden das Spiel, zwei nicht.
- Punkte: Flugzeit, Geschenke, Zielbonus, Herzbonus.
- Erzeugung: aufeinanderfolgende Hindernisse lassen immer die geforderte Lücke;
  Geschenke liegen nie in einem Hindernis. Geprüft über viele Durchläufe mit
  festem Zufallskeim.
- Etappen: Wechsel zur richtigen Zeit, Querungszeit sinkt wie vorgesehen, nach
  Bregenz folgt das Ziel.

Zufall läuft über einen Keim-Generator, der in Tests gesetzt werden kann — sonst sind
diese Prüfungen nicht reproduzierbar.

Von Hand geprüft wird, was kein Test abdeckt: Handy im Hoch- und Querformat, Laptop
mit Tastatur und Maus, Drehen des Geräts im laufenden Spiel, Tab-Wechsel, Privat-Modus,
und ob sich der Flug gut anfühlt. Die Zahlenwerte oben sind Startwerte und werden
nach dem Spieltest nachjustiert.

### Fehlerfälle

| Fall | Verhalten |
|---|---|
| `localStorage` gesperrt (Privat-Modus) | Spiel läuft normal, nur ohne Rekord. Jeder Zugriff in `try/catch`. |
| Gespeicherter Rekord beschädigt | wird verworfen, Spiel startet ohne Rekord |
| Tab-Wechsel, Anruf, Sperrbildschirm | Pause, kein Verlust |
| Gerät gedreht, Fenster verkleinert | neu vermessen, Pause, weiterspielen |
| Canvas nicht verfügbar | Hinweistext plus die Weihnachtsbotschaft als reines HTML |
| Sehr langsames Gerät | Schrittbegrenzung greift; das Spiel wird langsamer, nicht falsch |

Der letzte Fall ist wichtig: Selbst wenn das Spiel gar nicht läuft, soll die Botschaft
ankommen.

## Ausliefern

1. Git-Repository im Projektordner anlegen (noch keines vorhanden).
2. `index.html` im Wurzelverzeichnis — GitHub Pages liefert sie dann direkt unter der
   Repository-URL aus.
3. Auf GitHub veröffentlichen, Pages aktivieren.
4. URL prüfen: Handy über Mobilfunk, Laptop.
5. QR-Code aus der fertigen URL erzeugen, als druckfähige Datei (SVG und PNG) im
   Ordner `qr/`. Python 3.12 ist vorhanden.
6. QR-Code mit einem echten Handy testen, bevor etwas gedruckt wird.

Die URL sollte kurz und vorlesbar sein, damit sie auch am Laptop eingetippt werden
kann. Vorschlag für den Repository-Namen: `muhdolf`.

## Offene Punkte

Keine. Die Zahlenwerte der Flugphysik sind bewusst als Startwerte festgehalten und
werden im Spieltest nachjustiert; das ist Teil der Umsetzung, keine offene Frage.
