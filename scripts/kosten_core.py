"""Gemeinsame Rechenlogik fuer build_md.py und build_site_data.py.

Einzige Quelle fuer Summen, Kategorien und Saldo - beide Build-Skripte
importieren von hier, damit docs/kosten.md und die Website nie auseinanderlaufen.
"""
import collections
import csv
import pathlib
import sys

PERSONEN = ("Patrick", "Nora")


def pruefe(b1, b2):
    """Plausibilitaetscheck der CSVs. Gibt Warnungen zurueck, wirft nichts."""
    warnungen = []
    for blatt, rs in (("01_bezahlt.csv", b1), ("02_laufend.csv", b2)):
        for r in rs:
            z = (r.get("zahler") or "").strip()
            if z not in PERSONEN + ("TBD",):
                warnungen.append(f"{blatt} Nr. {r['nr']}: unbekannter Zahler {z!r} - "
                                 "faellt stillschweigend aus der Saldo-Basis")
    # Bargeld gehoert dem, der es abgehoben hat (ein Topf je Person). Zahlt
    # jemand "bar", der keinen Topf hat, oder wird ein Topf ueberzogen, stimmt
    # die Zuordnung nicht - dann kippt der Saldo.
    toepfe = kassen_toepfe(b2)
    for r in b2:
        if r["typ"] == "Ausgabe" and r["zahlmittel"] == "Bargeld" and r["zahler"] not in toepfe:
            warnungen.append(f"02_laufend.csv Nr. {r['nr']}: Barzahlung mit Zahler {r['zahler']!r}, "
                             f"abgehoben haben aber nur {sorted(toepfe)} - Zahler muss einen Bargeld-Topf haben")
    for person, t in toepfe.items():
        if t["bestand_nad"] < -0.5:
            warnungen.append(f"Bargeld-Topf {person} ueberzogen: {t['bestand_nad']:.0f} NAD - "
                             "Barzahlungen sind dem falschen Topf zugeordnet (CLAUDE.md Regel 9)")
    return warnungen


def kassen_toepfe(b2):
    """Ein Bargeld-Topf je Person: Abhebungen minus Barzahlungen, mit eigenem Kurs.

    Reihenfolge = erste Abhebung. Welcher Topf bei einer Barzahlung zaehlt,
    sagt der Nutzer ("Patrick Bar"/"Nora Bar") - keine Automatik (Regel 9).
    """
    toepfe = {}
    for r in b2:
        if r["typ"] != "Abhebung":
            continue
        t = toepfe.setdefault(r["zahler"], {"seit": r["datum"], "abgehoben_nad": 0.0, "abgehoben_eur": 0.0,
                                             "bar_nad": 0.0, "bar_eur": 0.0})
        t["abgehoben_nad"] += num(r["betrag_fw"])
        t["abgehoben_eur"] += num(r["betrag_eur"])
    for r in b2:
        if r["typ"] == "Ausgabe" and r["zahlmittel"] == "Bargeld" and r["zahler"] in toepfe:
            toepfe[r["zahler"]]["bar_nad"] += num(r["betrag_fw"])
            toepfe[r["zahler"]]["bar_eur"] += num(r["betrag_eur"])
    for t in toepfe.values():
        t["bestand_nad"] = t["abgehoben_nad"] - t["bar_nad"]
        t["bestand_eur"] = t["abgehoben_eur"] - t["bar_eur"]
        t["kurs"] = round(t["abgehoben_nad"] / t["abgehoben_eur"], 3) if t["abgehoben_eur"] else None
    return dict(sorted(toepfe.items(), key=lambda kv: kv[1]["seit"]))


def warne(warnungen):
    for w in warnungen:
        print("WARNUNG:", w, file=sys.stderr)

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def rows(name):
    with open(DATA / name, encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def num(v):
    if v is None or v.strip() in ("", "TBD"):
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0


def is_tbd(v):
    return v is None or v.strip() in ("", "TBD")


def load():
    return rows("01_bezahlt.csv"), rows("02_laufend.csv"), rows("03_verrechnung.csv")


def compute(b1, b2, b3):
    ausgaben2 = [r for r in b2 if r["typ"] == "Ausgabe"]

    plan_sum = sum(num(r["betrag_eur"]) for r in b1)
    bez_sum = sum(num(r["bezahlt_eur"]) for r in b1)
    off_sum = sum(num(r["offen_eur"]) for r in b1)
    aus_sum = sum(num(r["betrag_eur"]) for r in ausgaben2)
    bar_sum = sum(num(r["betrag_eur"]) for r in ausgaben2 if r["zahlmittel"] == "Bargeld")
    abh_sum = sum(num(r["betrag_eur"]) for r in b2 if r["typ"] == "Abhebung")
    gesamt = plan_sum + aus_sum
    bezahlt = bez_sum + aus_sum

    kat = collections.Counter()
    for r in b1:
        kat[r["kategorie"]] += num(r["betrag_eur"])
    for r in ausgaben2:
        kat[r["kategorie"] or "Sonstiges"] += num(r["betrag_eur"])
    kategorien = [(name, v) for name, v in sorted(kat.items(), key=lambda x: -x[1]) if v]

    def gezahlt(person):
        return (sum(num(r["bezahlt_eur"]) for r in b1 if r["zahler"] == person)
                + sum(num(r["betrag_eur"]) for r in ausgaben2 if r["zahler"] == person))

    patrick_gezahlt = gezahlt("Patrick")
    nora_gezahlt = gezahlt("Nora")
    tbd_gezahlt = round(bezahlt - patrick_gezahlt - nora_gezahlt, 2) + 0.0  # + 0.0: kein -0.0
    transfer = sum(num(v["betrag_eur"]) for v in b3)

    # Saldo = 50/50 auf Basis dessen, was bisher nachweislich von Patrick oder
    # Nora bezahlt wurde. Noch offene Posten gehoeren niemandem, bis sie jemand
    # bezahlt; Zahlungen mit Zahler TBD bleiben ausserhalb der Basis, statt
    # stillschweigend einer Person zugerechnet zu werden. Die Ueberweisung ist
    # Patricks Geld, das Nora ausgibt: zaehlt bei ihm plus, bei ihr minus.
    basis = patrick_gezahlt + nora_gezahlt
    anteil = basis / 2
    beitrag_patrick = patrick_gezahlt + transfer
    beitrag_nora = nora_gezahlt - transfer
    saldo_patrick = beitrag_patrick - anteil  # > 0: Nora schuldet Patrick

    return {
        "plan_sum": plan_sum,
        "bez_sum": bez_sum,
        "off_sum": off_sum,
        "aus_sum": aus_sum,
        "gesamt": gesamt,
        "bezahlt": bezahlt,
        "offen": off_sum,
        "kasse_abgehoben": abh_sum,
        "kasse_bar_ausgegeben": bar_sum,
        "kasse_bestand": abh_sum - bar_sum,
        "kasse": kassen_toepfe(b2),
        "kategorien": kategorien,
        "patrick_gezahlt": patrick_gezahlt,
        "nora_gezahlt": nora_gezahlt,
        "tbd_gezahlt": tbd_gezahlt,
        "transfer_patrick_nora": transfer,
        "saldo_basis": basis,
        "anteil_pro_person": anteil,
        "beitrag_patrick": beitrag_patrick,
        "beitrag_nora": beitrag_nora,
        "saldo_patrick": saldo_patrick,
    }
