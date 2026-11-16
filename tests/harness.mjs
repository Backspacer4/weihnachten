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
