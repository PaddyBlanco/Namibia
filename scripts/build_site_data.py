#!/usr/bin/env python3
"""Baut docs/assets/data/site-data.json fuer die GitHub-Pages-Seite.

Liest dieselben CSVs wie build_md.py, aggregiert sie fuer die Mobile-Site.
Buchungslinks werden hier absichtlich nie ausgegeben (siehe CLAUDE.md).

Aufruf: python3 scripts/build_site_data.py
"""
import csv
import datetime
import hashlib
import json
import pathlib
import re

from kosten_core import compute, is_tbd, load, num, pruefe, rows, warne

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OFFENE_PUNKTE_MD = ROOT / "docs" / "offene-punkte.md"
OUT = ROOT / "docs" / "assets" / "data" / "site-data.json"

TRIP_START = "2026-09-02"
TRIP_END = "2026-09-21"


INDEX_HTML = ROOT / "docs" / "index.html"
SERVICE_WORKER = ROOT / "docs" / "sw.js"
VERSIONED_ASSETS = ("assets/css/style.css", "assets/js/app.js")


def stamp_asset_versions():
    """Haengt ?v=<Inhalts-Hash> an style.css/app.js in index.html UND sw.js,
    und aktualisiert CACHE_VERSION im Service Worker.

    GitHub Pages liefert Assets mit Cache-Control max-age=600. Ohne Stempel
    laeuft nach einem Push bis zu 10 Minuten lang das alte app.js gegen die
    neue site-data.json (die selbst mit cache: no-store geladen wird). Der
    Hash aendert sich nur, wenn sich die Datei aendert - reine Datenupdates
    erzeugen also kein Diff in index.html/sw.js.

    Der Service Worker cached die App-Shell dauerhaft (siehe docs/sw.js) -
    CACHE_VERSION muss sich bei jeder Aenderung an style.css/app.js/sw.js
    selbst oder site-data.json aendern, sonst bleibt eine veraltete Version
    im Cache Storage der Nutzer haengen.
    """
    html = INDEX_HTML.read_text(encoding="utf-8")
    sw = SERVICE_WORKER.read_text(encoding="utf-8")
    digests = []
    for rel in VERSIONED_ASSETS:
        digest = hashlib.sha1((ROOT / "docs" / rel).read_bytes()).hexdigest()[:8]
        digests.append(digest)
        pattern = re.escape(rel) + r"(\?v=[0-9a-f]+)?"
        html = re.sub(pattern, rel + "?v=" + digest, html)
        sw = re.sub(pattern, rel + "?v=" + digest, sw)
    INDEX_HTML.write_text(html, encoding="utf-8")

    cache_version = hashlib.sha1(
        (",".join(digests) + hashlib.sha1(OUT.read_bytes()).hexdigest()).encode()
    ).hexdigest()[:8]
    sw = re.sub(r'const CACHE_VERSION = "[^"]*";', f'const CACHE_VERSION = "{cache_version}";', sw)
    SERVICE_WORKER.write_text(sw, encoding="utf-8")


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
    last_full_km = None  # km-Stand des letzten bestaetigten VOLLtanks
    for r in rows_:
        liter = None if is_tbd(r["liter"]) else float(r["liter"])
        preis_l_nad = None if is_tbd(r["preis_pro_liter_nad"]) else float(r["preis_pro_liter_nad"])
        km = None if is_tbd(r["kilometerstand"]) else float(r["kilometerstand"])
        betrag = num(r["betrag_eur"])
        preis_l_eur = round(betrag / liter, 3) if liter else None
        voll = (r.get("volltanken") or "").strip().lower() == "ja"

        # Verbrauch nur zwischen zwei bestaetigten Volltanks mit km-Stand:
        # Bei einer Teilbetankung ist unbekannt, wie viel wirklich verbraucht
        # wurde - dann lieber Bordcomputer-Schnitt als eine falsche Messung.
        verbrauch = None
        if voll and km is not None and last_full_km is not None and liter is not None and km > last_full_km:
            verbrauch = round(liter / (km - last_full_km) * 100, 1)
        if voll and km is not None:
            last_full_km = km

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

    # Verbrauchsquelle in Vertrauensreihenfolge: echte Fill-ups (aus
    # tatsaechlich getankten Litern + gefahrenen km) schlagen den vom
    # Bordcomputer abgelesenen Schnitt, der wiederum die Herstellerangabe
    # schlaegt - nie geraten, nur die beste verfuegbare echte Quelle.
    verbrauch_quelle = None
    if verbrauch_bekannt:
        verbrauch_avg = round(sum(verbrauch_bekannt) / len(verbrauch_bekannt), 1)
        verbrauch_quelle = "fillups"
    elif fahrzeug.get("bordcomputer_verbrauch_l_100km") is not None:
        verbrauch_avg = fahrzeug["bordcomputer_verbrauch_l_100km"]
        verbrauch_quelle = "bordcomputer"
    elif fahrzeug.get("herstellerverbrauch_l_100km") is not None:
        verbrauch_avg = fahrzeug["herstellerverbrauch_l_100km"]
        verbrauch_quelle = "hersteller"
    else:
        verbrauch_avg = None

    reichweite = None
    if tankgroesse and verbrauch_avg:
        reichweite = round(tankgroesse / verbrauch_avg * 100)

    summary = {
        "gesamt_liter": round(sum(liter_bekannt), 1) if liter_bekannt else None,
        "gesamt_kosten": round(sum(f["betrag_eur"] for f in fillups), 2),
        "avg_preis_liter_eur": round(sum(preise_bekannt) / len(preise_bekannt), 3) if preise_bekannt else None,
        "avg_verbrauch_l_100km": verbrauch_avg,
        "verbrauch_quelle": verbrauch_quelle,
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

    planung_path = DATA / "tankplanung.json"
    planung = None
    if planung_path.exists():
        planung = json.loads(planung_path.read_text(encoding="utf-8"))
        if tankgroesse and verbrauch_avg:
            verbraucht = planung["strecke_seit_volltank_km"] / 100 * verbrauch_avg
            rest_liter = max(tankgroesse - verbraucht, 0)
            planung["geschaetzte_rest_liter"] = round(rest_liter, 1)
            planung["geschaetzte_restreichweite_km"] = round(rest_liter / verbrauch_avg * 100)
        else:
            planung["geschaetzte_rest_liter"] = None
            planung["geschaetzte_restreichweite_km"] = None

    return {
        "fillups": fillups,
        "summary": summary,
        "tankstellen_hinweise": tankstellen,
        "planung": planung,
    }


def parse_offene_punkte():
    """Extrahiert die Tabellenzeilen unter '## Blockierend fuer korrekte Zahlen'."""
    text = OFFENE_PUNKTE_MD.read_text(encoding="utf-8")
    section = text.split("## Blockierend", 1)[1].split("\n## ", 1)[0]
    items = []
    for line in section.splitlines():
        m = re.match(r"^\|\s*(\d+)\s*\|(.+)\|(.+)\|\s*$", line)
        if not m:
            continue
        # Erst die **Bold**-Paare aufloesen, DANN strippen - umgekehrt
        # zerstoert das fuehrende strip("*") das oeffnende Paar, und die
        # schliessenden ** blieben mitten im Text stehen.
        punkt = re.sub(r"\*\*(.+?)\*\*", r"\1", m.group(2).strip())
        punkt = punkt.replace("**", "").strip()
        warum = m.group(3).strip()
        items.append({"punkt": punkt, "warum": warum})
    return items


def main():
    b1, b2, b3 = load()
    k = compute(b1, b2, b3)

    # ---------- Ausgaben (kombinierte Liste, ohne Abhebungen/Nullzeilen) ----------
    ausgaben = []
    for r in b1:
        betrag = num(r["betrag_eur"])
        if betrag <= 0:
            continue  # z.B. Quiver Tree: steht schon in Blatt 2, hier nur Referenz
        ausgaben.append({
            "id": "b1-" + r["nr"],
            "datum": r["datum"],
            "zeit": "",
            "kategorie": r["kategorie"],
            "beschreibung": r["beschreibung"],
            "betrag": round(betrag, 2),
            "betrag_fw": None,
            "waehrung": "EUR",
            "zahler": r["zahler"],
            "zahlmittel": r["zahlmittel"],
            "status": "offen" if num(r["offen_eur"]) > 0 else "bezahlt",
        })
    for r in b2:
        if r["typ"] != "Ausgabe":
            continue
        ausgaben.append({
            "id": "b2-" + r["nr"],
            "datum": r["datum"],
            "zeit": r["zeit"] or "",
            "kategorie": r["kategorie"] or "Sonstiges",
            "beschreibung": r["haendler"] or r["ort"],
            "betrag": round(num(r["betrag_eur"]), 2),
            "betrag_fw": round(num(r["betrag_fw"]), 2) if r["betrag_fw"] else None,
            "waehrung": r["waehrung"] or "EUR",
            "zahler": r["zahler"],
            "zahlmittel": r["zahlmittel"],
            "status": "bezahlt",
        })
    # Blatt-1-Zeilen tragen das Check-in-Datum, nicht das Zahldatum - kuenftige
    # Buchungen landen daher hinten. Die Website trennt "bisher" und "kommend"
    # selbst anhand des Geraetedatums (bisherigeAusgaben() in app.js).
    ausgaben.sort(key=lambda x: (x["datum"], x["zeit"]))

    # ---------- Kategorien ----------
    kategorien = [{"name": name, "betrag": round(v, 2)} for name, v in k["kategorien"]]

    # ---------- Summary (Rechenlogik in kosten_core.py) ----------
    summary = {key: round(k[key], 2) for key in (
        "gesamt", "bezahlt", "offen", "kasse_abgehoben", "kasse_bar_ausgegeben",
        "kasse_bestand", "patrick_gezahlt", "nora_gezahlt", "tbd_gezahlt",
        "transfer_patrick_nora", "saldo_basis", "anteil_pro_person",
        "beitrag_patrick", "beitrag_nora", "saldo_patrick")}

    # ---------- Reiseplan (aus Blatt 1, inkl. Naechte-Spanne) ----------
    # Aufgeteilte Posten (z.B. Flug haelftig Patrick/Nora) stehen als zwei
    # Zeilen in 01_bezahlt.csv - fuer die Zeitleiste zu einem Eintrag
    # zusammenfassen, sonst taucht derselbe Tag doppelt auf.
    ANTEIL_SUFFIX = re.compile(r"\s*-\s*\S+-Anteil\s*\(\d+%\)\s*$")
    plan = []
    plan_by_key = {}
    for r in b1:
        beschreibung = ANTEIL_SUFFIX.sub("", r["beschreibung"])
        key = (r["datum"], r["kategorie"], beschreibung)
        betrag = round(num(r["betrag_eur"]), 2)
        if key in plan_by_key:
            # Aufgeteilter Posten (z.B. Flug je zur Haelfte): Betrag summieren,
            # Zahler zusammenfuehren, damit die Zeitleiste "wer hat gezahlt"
            # korrekt zeigt.
            eintrag = plan_by_key[key]
            eintrag["betrag"] = round(eintrag["betrag"] + betrag, 2)
            if r["zahler"] not in eintrag["zahler"].split(" + "):
                eintrag["zahler"] += " + " + r["zahler"]
            if r["zahlmittel"] not in eintrag["zahlmittel"].split(" + "):
                eintrag["zahlmittel"] += " + " + r["zahlmittel"]
            if num(r["offen_eur"]) > 0 and betrag > 0:
                eintrag["status"] = "offen"
            continue
        start = datetime.date.fromisoformat(r["datum"])
        naechte = int(float(r["naechte"])) if r["naechte"] else 0
        ende = (start + datetime.timedelta(days=naechte)).isoformat() if naechte else r["datum"]
        eintrag = {
            "start": r["datum"],
            "ende": ende,
            "naechte": naechte,
            "kategorie": r["kategorie"],
            "beschreibung": beschreibung,
            "betrag": betrag,
            "zahler": r["zahler"],
            "zahlmittel": r["zahlmittel"],
            "status": "offen" if num(r["offen_eur"]) > 0 and num(r["betrag_eur"]) > 0 else "bezahlt",
            "info_link": r.get("info_link") or None,
            "fahrzeit": r.get("fahrzeit") or None,
        }
        plan_by_key[key] = eintrag
        plan.append(eintrag)

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
    stamp_asset_versions()
    warne(pruefe(b1, b2))


if __name__ == "__main__":
    main()
