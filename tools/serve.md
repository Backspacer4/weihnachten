# Auf dem Handy testen, bevor es online geht

Am Laptop im Projektordner einen kleinen Webserver starten:

    python -m http.server 8000

Die IP-Adresse des Laptops herausfinden (Windows):

    ipconfig

Gesucht ist die Zeile "IPv4-Adresse" des aktiven WLAN-Adapters, etwa
`192.168.0.42`. Dann am Handy im gleichen WLAN im Browser aufrufen:

    http://192.168.0.42:8000/

Beenden mit Strg+C.

Das ist nur fuer den Test. Ausgeliefert wird spaeter ueber GitHub Pages, und
dafuer braucht es keinen eigenen Server.

Am Laptop allein genuegt uebrigens ein Doppelklick auf `index.html` -- das
Spiel braucht keinen Webserver. Nur fuer den Zugriff vom Handy aus ist einer
noetig.
