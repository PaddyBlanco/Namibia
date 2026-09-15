"""Gemeinsame Rechenlogik fuer build_md.py und build_site_data.py.

Einzige Quelle fuer Summen, Kategorien und Saldo - beide Build-Skripte
importieren von hier, damit docs/kosten.md und die Website nie auseinanderlaufen.
"""
import collections
import csv
import pathlib
import sys

PERSONEN = ("Patrick", "Nora")
KASSE = "Kasse"  # Zahler-Wert fuer Barzahlungen aus der gemeinsamen Reisekasse


def pruefe(b1, b2):
    """Plausibilitaetscheck der CSVs. Gibt Warnungen zurueck, wirft nichts."""
    warnungen = []
    for blatt, rs in (("01_bezahlt.csv", b1), ("02_laufend.csv", b2)):
        for r in rs:
            z = (r.get("zahler") or "").strip()
            if z not in PERSONEN + ("TBD", KASSE):
                warnungen.append(f"{blatt} Nr. {r['nr']}: unbekannter Zahler {z!r} - "
                                 "faellt stillschweigend aus der Saldo-Basis")
            # Gemeinsame Kasse (Regel 9, seit 15.09.2026): Barzahlungen haben
            # keinen Zahler mehr, sie kommen aus dem Topf. Steht dort eine
            # Person, wuerde sie im Saldo doppelt zaehlen (Abhebung + Ausgabe).
            bar = (r.get("zahlmittel") or "") == "Bargeld" and r.get("typ", "Ausgabe") == "Ausgabe"
            if bar and z != KASSE:
                warnungen.append(f"{blatt} Nr. {r['nr']}: Barzahlung mit Zahler {z!r} - "
                                 f"muss {KASSE!r} sein (gemeinsame Kasse, Regel 9)")
    k = reisekasse(b2)
    if k["bestand_nad"] < -0.5:
        warnungen.append(f"Reisekasse ueberzogen: {k['bestand_nad']:.0f} NAD - "
                         "Abhebung fehlt oder Barzahlung doppelt (CLAUDE.md Regel 9)")
    return warnungen


def reisekasse(b2):
    """Eine gemeinsame Bargeld-Kasse: alle Abhebungen minus alle Barzahlungen.

    Kurs = Mischkurs aller Abhebungen (Regel 7). Wer abgehoben hat, steht in
    der Abhebungszeile und zaehlt im Saldo (Regel 9); die Barzahlung selbst
    gehoert niemandem (Zahler KASSE).
    """
    k = {"seit": None, "abgehoben_nad": 0.0, "abgehoben_eur": 0.0, "bar_nad": 0.0, "bar_eur": 0.0}
    for r in b2:
        if r["typ"] == "Abhebung":
            k["seit"] = k["seit"] or r["datum"]
            k["abgehoben_nad"] += num(r["betrag_fw"])
            k["abgehoben_eur"] += num(r["betrag_eur"])
        elif r["typ"] == "Ausgabe" and r["zahlmittel"] == "Bargeld":
            k["bar_nad"] += num(r["betrag_fw"])
            k["bar_eur"] += num(r["betrag_eur"])
    k["bestand_nad"] = k["abgehoben_nad"] - k["bar_nad"]
    k["bestand_eur"] = k["abgehoben_eur"] - k["bar_eur"]
    k["kurs"] = round(k["abgehoben_nad"] / k["abgehoben_eur"], 3) if k["abgehoben_eur"] else None
    return k


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

    # Wer hat was vorgestreckt? Kartenzahlungen beim Zahler; Bargeld zaehlt
    # bei der ABHEBUNG (wer abhebt, streckt fuer beide vor - Regel 9, seit
    # 15.09.2026), die Barzahlung selbst bei niemandem (Zahler KASSE), sonst
    # wuerde dasselbe Geld doppelt gezaehlt.
    def gezahlt(person):
        return (sum(num(r["bezahlt_eur"]) for r in b1 if r["zahler"] == person)
                + sum(num(r["betrag_eur"]) for r in ausgaben2
                      if r["zahler"] == person and r["zahlmittel"] != "Bargeld")
                + sum(num(r["betrag_eur"]) for r in b2 if r["typ"] == "Abhebung" and r["zahler"] == person))

    patrick_gezahlt = gezahlt("Patrick")
    nora_gezahlt = gezahlt("Nora")
    tbd_gezahlt = gezahlt("TBD")
    transfer = sum(num(v["betrag_eur"]) for v in b3)

    # Saldo = 50/50 auf Basis dessen, was bisher nachweislich von Patrick oder
    # Nora vorgestreckt wurde (Karte + Abhebungen). Noch offene Posten gehoeren
    # niemandem, bis sie jemand bezahlt; Zahlungen mit Zahler TBD bleiben
    # ausserhalb der Basis. Bargeld, das noch in der Kasse liegt, ist damit
    # schon haelftig verrechnet ("wer abhebt, dem schuldet der andere sofort
    # die Haelfte"). Die Ueberweisung ist Patricks Geld, das Nora ausgibt:
    # zaehlt bei ihm plus, bei ihr minus.
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
        "kasse": {"Reisekasse": reisekasse(b2)},
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


if __name__ == "__main__":
    # Selbsttest (Ponytail): Patrick hebt 200 EUR ab, Nora zahlt 100 EUR per
    # Karte, 50 EUR gehen bar aus der Kasse weg. Vorgestreckt: Patrick 200,
    # Nora 100 -> Basis 300, Anteil 150, Nora schuldet Patrick 50. Die
    # Barzahlung darf den Saldo nicht bewegen, wohl aber die Kosten.
    b1 = []
    b2 = [
        {"nr": "1", "typ": "Abhebung", "datum": "2026-09-01", "kategorie": "Bargeld", "betrag_fw": "3800",
         "betrag_eur": "200", "zahler": "Patrick", "zahlmittel": "Oberbank Debit"},
        {"nr": "2", "typ": "Ausgabe", "datum": "2026-09-01", "kategorie": "Restaurant", "betrag_fw": "",
         "betrag_eur": "100", "zahler": "Nora", "zahlmittel": "N26 Debit"},
        {"nr": "3", "typ": "Ausgabe", "datum": "2026-09-02", "kategorie": "Eintritt", "betrag_fw": "950",
         "betrag_eur": "50", "zahler": KASSE, "zahlmittel": "Bargeld"},
    ]
    k = compute(b1, b2, [])
    assert (k["patrick_gezahlt"], k["nora_gezahlt"]) == (200.0, 100.0), k
    assert k["saldo_patrick"] == 50.0 and k["gesamt"] == 150.0 and k["kasse_bestand"] == 150.0, k
    assert k["kasse"]["Reisekasse"]["bestand_nad"] == 2850.0 and k["kasse"]["Reisekasse"]["kurs"] == 19.0
    assert pruefe(b1, b2) == []
    b2[2]["zahler"] = "Nora"
    assert any("gemeinsame Kasse" in w for w in pruefe(b1, b2))
    print("kosten_core Selbsttest ok")
