#!/usr/bin/env python3
"""Schnellweg fuer Belege: eine Zeile anlegen/aendern/loeschen, bauen, pushen.

Beispiele (Datum = heute in Windhoek, wenn nicht angegeben):
  python3 scripts/ausgabe.py add --ort Sesriem --haendler "Tankstellenshop" \
      --kat Lebensmittel --eur 21.15 --zahler Nora --zahlmittel n26
  python3 scripts/ausgabe.py add --ort Solitaire --haendler "Solitaire Bakery" \
      --kat Restaurant --nad 120 --zahlmittel bar            # Zahler wird Patrick, EUR zum Kassenkurs
  python3 scripts/ausgabe.py add --ort Solitaire --haendler Tankstelle --kat Tanken \
      --eur 83.94 --zahler Nora --zahlmittel n26 --liter 54.6 --km 22085 --voll ja
  python3 scripts/ausgabe.py edit b2-25 kategorie=Lebensmittel
  python3 scripts/ausgabe.py delete b2-1

Regeln aus CLAUDE.md sind eingebaut: Bargeld => Zahler Patrick (Regel 9),
Bar-EUR zum Kassenkurs (Regel 7), Kategorien fix, NAD ohne EUR bei Karte
=> vorlaeufiger Kurs nur mit --kurs-schaetzen (Regel 5), Tankdetails in
04_tanken.csv (Abschnitt Tanken). Danach: build_md, build_site_data,
Commit, Push - ausser --no-push.
"""
import argparse
import csv
import datetime
import io
import pathlib
import subprocess
import sys
import zoneinfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
LAUFEND = ROOT / "data" / "02_laufend.csv"
BEZAHLT = ROOT / "data" / "01_bezahlt.csv"
TANKEN = ROOT / "data" / "04_tanken.csv"

KATEGORIEN = ["Flug", "Mietwagen", "Unterkunft", "Tanken", "Lebensmittel", "Restaurant",
              "Eintritt", "Aktivitäten", "Ausrüstung", "Gebühren", "Shopping", "Sonstiges"]
ZAHLMITTEL = {"n26": "N26 Debit", "debit": "Oberbank Debit", "oberbank": "Oberbank Debit",
              "bar": "Bargeld", "bargeld": "Bargeld", "kredit": "card complete",
              "cardcomplete": "card complete", "tbd": "TBD"}
BAR_KURS = 18.633          # Regel 7: Kurs der ATM-Abhebung vom 03.09.2026
KARTE_KURS_SCHAETZ = 18.43  # nur mit --kurs-schaetzen, als vorlaeufig markiert


def heute():
    return datetime.datetime.now(zoneinfo.ZoneInfo("Africa/Windhoek")).date().isoformat()


def read(path):
    with open(path, encoding="utf-8", newline="") as fh:
        r = csv.DictReader(fh)
        return list(r), r.fieldnames


def write(path, rows, fieldnames):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fieldnames, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    path.write_text(buf.getvalue(), encoding="utf-8")


def fmt(x):
    return f"{x:.2f}"


def cmd_add(a):
    rows, fields = read(LAUFEND)
    nr = max(int(r["nr"]) for r in rows) + 1
    if a.kat not in KATEGORIEN:
        sys.exit(f"Kategorie {a.kat!r} unbekannt. Erlaubt: {', '.join(KATEGORIEN)}")
    zm = ZAHLMITTEL.get(a.zahlmittel.lower().replace(" ", ""), a.zahlmittel)
    zahler = a.zahler
    notes = [a.anmerkung] if a.anmerkung else []
    if zm == "Bargeld":
        if zahler and zahler != "Patrick":
            notes.append(f"bar von {zahler} bezahlt - Zahler laut Regel 9 Patrick (Abhebender)")
        zahler = "Patrick"
    if zahler not in ("Patrick", "Nora", "TBD"):
        sys.exit("--zahler Patrick|Nora|TBD noetig (ausser bei Bargeld)")

    if a.nad is None and a.eur is None:
        sys.exit("--nad und/oder --eur angeben")
    eur = a.eur
    if eur is None:
        if zm == "Bargeld":
            eur = round(a.nad / BAR_KURS, 2)
            notes.append(f"EUR zum Kassenkurs {BAR_KURS} NAD/EUR")
        elif a.kurs_schaetzen:
            eur = round(a.nad / KARTE_KURS_SCHAETZ, 2)
            notes.append(f"EUR VORLAEUFIG mit {KARTE_KURS_SCHAETZ} NAD/EUR geschaetzt - echten Kartenbetrag nachtragen")
        else:
            sys.exit("Kartenzahlung in NAD ohne EUR-Betrag: --eur angeben oder --kurs-schaetzen (Regel 5)")

    if a.liter or a.km or a.preis_l:
        if a.kat != "Tanken":
            sys.exit("--liter/--km/--preis-l nur bei --kat Tanken")
        trows, tfields = read(TANKEN)
        tnr = max(int(r["nr"]) for r in trows) + 1
        notes.append(f"Tankdetails in 04_tanken.csv Nr. {tnr}")
        trows.append({
            "nr": str(tnr), "datum": a.datum, "ort": a.ort,
            "liter": fmt(a.liter) if a.liter else "TBD",
            "preis_pro_liter_nad": fmt(a.preis_l) if a.preis_l else "TBD",
            "kilometerstand": str(a.km) if a.km else "TBD",
            "betrag_eur": fmt(eur), "zahler": zahler,
            "anmerkung": f"Entspricht Blatt 02 Nr. {nr}",
            "volltanken": a.voll or "TBD",
        })
        write(TANKEN, trows, tfields)
        if not a.voll:
            print("HINWEIS: volltanken=TBD - beim Nutzer nachfragen (Verbrauch zaehlt nur zwischen Volltanks).")

    rows.append({
        "nr": str(nr), "datum": a.datum, "zeit": a.zeit or "", "typ": "Ausgabe",
        "ort": a.ort, "haendler": a.haendler or a.ort, "kategorie": a.kat,
        "betrag_fw": fmt(a.nad) if a.nad is not None else "",
        "waehrung": "NAD" if a.nad is not None else "EUR",
        "betrag_eur": fmt(eur), "zahler": zahler, "zahlmittel": zm,
        "anmerkung": "; ".join(n for n in notes if n),
    })
    write(LAUFEND, rows, fields)
    print(f"+ b2-{nr}: {a.datum} {a.haendler or a.ort} {a.kat} {fmt(eur)} EUR {zahler}/{zm}")
    return a.msg or f"{a.haendler or a.ort}: {a.kat} ({fmt(eur).replace('.', ',')} EUR, {zahler}/{zm})"


def finde(id_):
    blatt, nr = id_.split("-", 1)
    path = {"b1": BEZAHLT, "b2": LAUFEND}[blatt]
    rows, fields = read(path)
    for r in rows:
        if r["nr"] == nr:
            return path, rows, fields, r
    sys.exit(f"{id_} nicht gefunden")


def cmd_edit(a):
    path, rows, fields, r = finde(a.id)
    changes = []
    for kv in a.felder:
        k, v = kv.split("=", 1)
        if k not in fields:
            sys.exit(f"Feld {k!r} gibt es nicht. Felder: {', '.join(fields)}")
        if k == "kategorie" and v not in KATEGORIEN:
            sys.exit(f"Kategorie {v!r} unbekannt")
        if k == "zahlmittel":
            v = ZAHLMITTEL.get(v.lower().replace(" ", ""), v)
        changes.append(f"{k} {r[k]!r} -> {v!r}")
        r[k] = v
    if r.get("zahlmittel") == "Bargeld" and r.get("zahler") != "Patrick":
        changes.append(f"zahler {r['zahler']!r} -> 'Patrick' (Regel 9)")
        r["zahler"] = "Patrick"
    write(path, rows, fields)
    print(f"~ {a.id}: " + "; ".join(changes))
    return a.msg or f"{a.id} geaendert: " + "; ".join(changes)


def cmd_delete(a):
    path, rows, fields, r = finde(a.id)
    if path == BEZAHLT and not a.force:
        sys.exit("Blatt-1-Zeilen nicht loeschen (Buchungsuebersicht/Reiseplan) - bei Vor-Ort-Zahlung "
                 "nach Regel 6 auf 0 setzen: edit b1-N betrag_eur=0.00 bezahlt_eur=0.00 offen_eur=0.00 status=... "
                 "Oder --force, wenn die Buchung wirklich nie existierte.")
    rows.remove(r)
    write(path, rows, fields)
    label = r.get("haendler") or r.get("beschreibung")
    print(f"- {a.id}: {label} {r['datum']} {r['betrag_eur']} EUR entfernt (nr bleibt frei)")
    return a.msg or f"{a.id} {label} entfernt"


def build_and_push(msg, push):
    subprocess.run([sys.executable, "scripts/build_md.py"], cwd=ROOT, check=True)
    subprocess.run([sys.executable, "scripts/build_site_data.py"], cwd=ROOT, check=True)
    if not push:
        print("(kein Commit/Push: --no-push)")
        return
    subprocess.run(["git", "add", "data", "docs"], cwd=ROOT, check=True)
    trailer = (ROOT / ".claude" / "commit-trailer.txt")
    body = msg + ("\n\n" + trailer.read_text(encoding="utf-8").strip() if trailer.exists() else "")
    subprocess.run(["git", "commit", "-q", "-m", body], cwd=ROOT, check=True)
    branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT, text=True).strip()
    subprocess.run(["git", "push", "-u", "origin", branch], cwd=ROOT, check=True)
    print(f"gepusht auf {branch}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--no-push", action="store_true")
    p.add_argument("--msg", help="Commit-Nachricht (sonst automatisch)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("add")
    s.add_argument("--datum", default=heute())
    s.add_argument("--zeit")
    s.add_argument("--ort", required=True)
    s.add_argument("--haendler")
    s.add_argument("--kat", required=True)
    s.add_argument("--nad", type=float)
    s.add_argument("--eur", type=float)
    s.add_argument("--zahler")
    s.add_argument("--zahlmittel", required=True, help="n26|debit|bar|kredit|tbd")
    s.add_argument("--anmerkung")
    s.add_argument("--kurs-schaetzen", action="store_true")
    s.add_argument("--liter", type=float)
    s.add_argument("--preis-l", type=float, help="NAD je Liter")
    s.add_argument("--km", type=int)
    s.add_argument("--voll", choices=["ja", "nein"])
    s.set_defaults(fn=cmd_add)

    s = sub.add_parser("edit")
    s.add_argument("id", help="b2-<nr> oder b1-<nr>")
    s.add_argument("felder", nargs="+", help="feld=wert ...")
    s.set_defaults(fn=cmd_edit)

    s = sub.add_parser("delete")
    s.add_argument("id")
    s.add_argument("--force", action="store_true")
    s.set_defaults(fn=cmd_delete)

    a = p.parse_args()
    msg = a.fn(a)
    build_and_push(msg, not a.no_push)


if __name__ == "__main__":
    main()
