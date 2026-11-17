"""Erzeugt den QR-Code fuer Muhdolfs Geschenke-Flug.

Aufruf:
    python tools/qr.py https://backspacer4.github.io/weihnachten/

Ergebnis:
    qr/weihnachten.png  -- fuer Word, Mail und schnellen Druck
    qr/weihnachten.svg  -- verlustfrei skalierbar, fuer die Druckerei

Einmalig installieren, falls noch nicht vorhanden:
    python -m pip install "qrcode[pil]"

Hinweis zum Druck: Fehlerkorrekturstufe Q vertraegt auf Papier auch einen
Knick oder einen Fleck. Trotzdem gilt -- unter etwa 2 cm Seitenlaenge wird es
auf Karten eng, und das ist der haeufigste Grund, warum ein QR-Code auf einer
Weihnachtskarte nicht funktioniert. Vor dem Druck mit einem echten Handy
pruefen, nicht am Bildschirm.
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
    stufe = qrcode.constants.ERROR_CORRECT_Q

    png = qrcode.QRCode(error_correction=stufe, box_size=12, border=4)
    png.add_data(url)
    png.make(fit=True)
    png.make_image(fill_color='black', back_color='white').save(ziel / 'weihnachten.png')

    svg = qrcode.QRCode(error_correction=stufe, box_size=12, border=4,
                        image_factory=qrcode.image.svg.SvgPathImage)
    svg.add_data(url)
    svg.make(fit=True)
    svg.make_image().save(str(ziel / 'weihnachten.svg'))

    module = png.modules_count
    print(f'QR-Code fuer {url}')
    print(f'  {ziel.resolve()}')
    print(f'  Raster {module} x {module} Module, Fehlerkorrektur Q')
    print('Vor dem Druck mit einem echten Handy pruefen.')


if __name__ == '__main__':
    main()
