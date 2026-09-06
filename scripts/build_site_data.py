#!/usr/bin/env python3
"""Baut docs/assets/data/site-data.json fuer die GitHub-Pages-Seite.

Liest dieselben CSVs wie build_md.py, aggregiert sie fuer die Mobile-Site.
Buchungslinks werden hier absichtlich nie ausgegeben (siehe CLAUDE.md).

Aufruf: python3 scripts/build_site_data.py
"""
import csv
import collections
import datetime
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OFFENE_PUNKTE_MD = ROOT / "docs" / "offene-punkte.md"
OUT = ROOT / "docs" / "assets" / "data" / "site-data.json"

TRIP_START = "2026-09-02"
TRIP_END = "2026-09-21"


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


def parse_tanken():
    """Fill-ups aus 04_tanken.csv, angereichert um berechnete Kennzahlen.

    Verbrauch (L/100km) wird nur zwischen zwei aufeinanderfolgenden Fill-ups
    berechnet, die BEIDE einen Kilometerstand haben - fehlt einer, bleibt
    das Feld None statt geraten zu werden.
    """
    try:
        rows_ = rows("04_tanken.csv")
    except FileNotFoundError:
        return {"fillups": [], "summary": None}

    fillups = []
    last_km = None
    for r in rows_:
        liter = None if is_tbd(r["liter"]) else float(r["liter"])
        preis_l_nad = None if is_tbd(r["preis_pro_liter_nad"]) else float(r["preis_pro_liter_nad"])
        km = None if is_tbd(r["kilometerstand"]) else float(r["kilometerstand"])
        betrag = num(r["betrag_eur"])
        preis_l_eur = round(betrag / liter, 3) if liter else None

        verbrauch = None
        if km is not None and last_km is not None and liter is not None and km > last_km:
            verbrauch = round(liter / (km - last_km) * 100, 1)
        if km is not None:
            last_km = km

        fillups.append({
            "datum": r["datum"],
            "ort": r["ort"],
            "liter": liter,
            "preis_pro_liter_nad": preis_l_nad,
            "preis_pro_liter_eur": preis_l_eur,
            "betrag_eur": round(betrag, 2),
            "kilometerstand": km,
            "verbrauch_l_100km": verbrauch,
            "zahler": r["zahler"],
            "anmerkung": r["anmerkung"],
        })

    liter_bekannt = [f["liter"] for f in fillups if f["liter"] is not None]
    verbrauch_bekannt = [f["verbrauch_l_100km"] for f in fillups if f["verbrauch_l_100km"] is not None]
    preise_bekannt = [f["preis_pro_liter_eur"] for f in fillups if f["preis_pro_liter_eur"] is not None]

    fahrzeug_path = DATA / "fahrzeug.json"
    fahrzeug = json.loads(fahrzeug_path.read_text(encoding="utf-8")) if fahrzeug_path.exists() else {}
    tankgroesse = fahrzeug.get("tankgroesse_liter")
    verbrauch_avg = round(sum(verbrauch_bekannt) / len(verbrauch_bekannt), 1) if verbrauch_bekannt else fahrzeug.get("herstellerverbrauch_l_100km")

    reichweite = None
    if tankgroesse and verbrauch_avg:
        reichweite = round(tankgroesse / verbrauch_avg * 100)

    summary = {
        "gesamt_liter": round(sum(liter_bekannt), 1) if liter_bekannt else None,
        "gesamt_kosten": round(sum(f["betrag_eur"] for f in fillups), 2),
        "avg_preis_liter_eur": round(sum(preise_bekannt) / len(preise_bekannt), 3) if preise_bekannt else None,
        "avg_verbrauch_l_100km": verbrauch_avg,
        "fahrzeug_modell": fahrzeug.get("modell", "TBD"),
        "tankgroesse_liter": tankgroesse,
        "reichweite_km": reichweite,
    }

    tankstellen_path = DATA / "tankstellen_hinweise.csv"
    tankstellen = []
    if tankstellen_path.exists():
        with open(tankstellen_path, encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                tankstellen.append({"abschnitt": r["naeheAbschnitt"], "hinweis": r["hinweis"]})

    return {"fillups": fillups, "summary": summary, "tankstellen_hinweise": tankstellen}


def parse_offene_punkte():
    """Extrahiert die Tabellenzeilen unter '## Blockierend fuer korrekte Zahlen'."""
    text = OFFENE_PUNKTE_MD.read_text(encoding="utf-8")
    section = text.split("## Blockierend", 1)[1].split("\n## ", 1)[0]
    items = []
    for line in section.splitlines():
        m = re.match(r"^\|\s*(\d+)\s*\|(.+)\|(.+)\|\s*$", line)
        if not m:
            continue
        punkt = m.group(2).strip().strip("*")
        punkt = re.sub(r"\*\*(.+?)\*\*", r"\1", punkt)
        warum = m.group(3).strip()
        items.append({"punkt": punkt, "warum": warum})
    return items


def main():
    b1 = rows("01_bezahlt.csv")
    b2 = rows("02_laufend.csv")
    b3 = rows("03_verrechnung.csv")

    # ---------- Ausgaben (kombinierte Liste, ohne Abhebungen/Nullzeilen) ----------
    ausgaben = []
    for r in b1:
        betrag = num(r["betrag_eur"])
        if betrag <= 0:
            continue  # z.B. Quiver Tree: steht schon in Blatt 2, hier nur Referenz
        ausgaben.append({
            "datum": r["datum"],
            "kategorie": r["kategorie"],
            "beschreibung": r["beschreibung"],
            "betrag": round(betrag, 2),
            "zahler": r["zahler"],
            "status": "offen" if num(r["offen_eur"]) > 0 else "bezahlt",
        })
    for r in b2:
        if r["typ"] != "Ausgabe":
            continue
        ausgaben.append({
            "datum": r["datum"],
            "kategorie": r["kategorie"] or "Sonstiges",
            "beschreibung": r["haendler"] or r["ort"],
            "betrag": round(num(r["betrag_eur"]), 2),
            "zahler": r["zahler"],
            "status": "bezahlt",
        })
    ausgaben.sort(key=lambda x: x["datum"])

    # ---------- Kategorien ----------
    kat = collections.Counter()
    for a in ausgaben:
        kat[a["kategorie"]] += a["betrag"]
    kategorien = [{"name": k, "betrag": round(v, 2)}
                  for k, v in sorted(kat.items(), key=lambda x: -x[1]) if v]

    # ---------- Summary ----------
    plan_sum = sum(num(r["betrag_eur"]) for r in b1)
    bez_sum = sum(num(r["bezahlt_eur"]) for r in b1)
    off_sum = sum(num(r["offen_eur"]) for r in b1)
    aus_sum = sum(num(r["betrag_eur"]) for r in b2 if r["typ"] == "Ausgabe")
    bar_sum = sum(num(r["betrag_eur"]) for r in b2 if r["typ"] == "Ausgabe" and r["zahlmittel"] == "Bargeld")
    abh_sum = sum(num(r["betrag_eur"]) for r in b2 if r["typ"] == "Abhebung")
    gesamt = plan_sum + aus_sum

    pv = sum(num(r["bezahlt_eur"]) for r in b1 if r["zahler"] == "Patrick")
    nv = sum(num(r["bezahlt_eur"]) for r in b1 if r["zahler"] == "Nora")
    pl = sum(num(r["betrag_eur"]) for r in b2 if r["typ"] == "Ausgabe" and r["zahler"] == "Patrick")
    nl = sum(num(r["betrag_eur"]) for r in b2 if r["typ"] == "Ausgabe" and r["zahler"] == "Nora")
    transfer = sum(num(v["betrag_eur"]) for v in b3)

    beitrag_patrick = pv + pl + transfer
    beitrag_nora = nv + nl
    anteil = gesamt / 2
    saldo_patrick = beitrag_patrick - anteil

    summary = {
        "gesamt": round(gesamt, 2),
        "bezahlt": round(bez_sum + aus_sum, 2),
        "offen": round(off_sum, 2),
        "kasse_abgehoben": round(abh_sum, 2),
        "kasse_bar_ausgegeben": round(bar_sum, 2),
        "kasse_bestand": round(abh_sum - bar_sum, 2),
        "beitrag_patrick": round(beitrag_patrick, 2),
        "beitrag_nora": round(beitrag_nora, 2),
        "anteil_pro_person": round(anteil, 2),
        "saldo_patrick": round(saldo_patrick, 2),
        "transfer_patrick_nora": round(transfer, 2),
    }

    # ---------- Reiseplan (aus Blatt 1, inkl. Naechte-Spanne) ----------
    plan = []
    for r in b1:
        start = datetime.date.fromisoformat(r["datum"])
        naechte = int(float(r["naechte"])) if r["naechte"] else 0
        ende = (start + datetime.timedelta(days=naechte)).isoformat() if naechte else r["datum"]
        plan.append({
            "start": r["datum"],
            "ende": ende,
            "naechte": naechte,
            "kategorie": r["kategorie"],
            "beschreibung": r["beschreibung"],
            "status": "offen" if num(r["offen_eur"]) > 0 and num(r["betrag_eur"]) > 0 else "bezahlt",
        })

    offene_punkte = parse_offene_punkte()
    tanken = parse_tanken()

    site_data = {
        "generated_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "trip": {"start": TRIP_START, "end": TRIP_END},
        "summary": summary,
        "kategorien": kategorien,
        "ausgaben": ausgaben,
        "plan": plan,
        "tanken": tanken,
        "offene_punkte": offene_punkte,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(site_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("geschrieben:", OUT)


if __name__ == "__main__":
    main()
