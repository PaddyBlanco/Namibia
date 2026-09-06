#!/usr/bin/env python3
"""Baut docs/kosten.md aus data/*.csv - schnelle, lesbare Markdown-Ansicht.

Aufruf: python3 scripts/build_md.py
"""
import csv
import collections
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "docs" / "kosten.md"


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


def eur(v):
    return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def md_table(header, rows_):
    out = ["| " + " | ".join(header) + " |",
           "|" + "|".join(["---"] * len(header)) + "|"]
    for r in rows_:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def main():
    b1 = rows("01_bezahlt.csv")
    b2 = rows("02_laufend.csv")
    b3 = rows("03_verrechnung.csv")

    lines = []
    lines.append("# Namibia 2026 – Kosten")
    lines.append("")
    lines.append("Automatisch erzeugt aus `data/*.csv` mit `scripts/build_md.py`. "
                  "**Nicht direkt editieren** — Änderungen gehen in den CSVs verloren.")
    lines.append("")

    # ---------------- Blatt 1
    lines.append("## 1. Bereits gebuchte & bezahlte Kosten (Vorab-/Fixkosten)")
    lines.append("")
    header = ["Nr", "Datum", "Kategorie", "Beschreibung", "Nächte", "Betrag",
              "Status", "bezahlt", "offen", "Zahler", "Zahlmittel", "Anmerkung"]
    trows = []
    plan_sum = bez_sum = off_sum = 0.0
    for r in b1:
        plan_sum += num(r["betrag_eur"]); bez_sum += num(r["bezahlt_eur"]); off_sum += num(r["offen_eur"])
        flag = " ⚠️" if r["zahler"] == "TBD" or "UNKLAR" in r["anmerkung"].upper() or "PRUEFEN" in r["anmerkung"].upper() else ""
        trows.append([r["nr"], r["datum"], r["kategorie"], r["beschreibung"],
                      r["naechte"] or "–", eur(num(r["betrag_eur"])), r["status"],
                      eur(num(r["bezahlt_eur"])), eur(num(r["offen_eur"])),
                      r["zahler"] + flag, r["zahlmittel"], r["anmerkung"] or "–"])
    lines.append(md_table(header, trows))
    lines.append("")
    lines.append(f"**Summe:** {eur(plan_sum)} geplant · {eur(bez_sum)} bezahlt · **{eur(off_sum)} noch offen**")
    lines.append("")

    # ---------------- Blatt 2
    lines.append("## 2. Laufende Kosten während der Reise")
    lines.append("")
    lines.append("`Typ = Abhebung` ist eine Umbuchung in die Reisekasse, **keine Ausgabe**. "
                  "Nur `Typ = Ausgabe` zählt in den Summen.")
    lines.append("")
    header2 = ["Nr", "Datum", "Zeit", "Typ", "Ort", "Händler", "Kategorie",
               "Betrag FW", "€", "Zahler", "Zahlmittel", "Kurs", "Anmerkung"]
    trows2 = []
    aus_sum = abh_sum = bar_sum = 0.0
    for r in b2:
        betrag_eur = num(r["betrag_eur"])
        if r["typ"] == "Ausgabe":
            aus_sum += betrag_eur
            if r["zahlmittel"] == "Bargeld":
                bar_sum += betrag_eur
        elif r["typ"] == "Abhebung":
            abh_sum += betrag_eur
        fw = f"{r['betrag_fw']} {r['waehrung']}" if r["betrag_fw"] else "–"
        kurs = ""
        if r["betrag_fw"] and betrag_eur:
            kurs = f"{num(r['betrag_fw']) / betrag_eur:.3f}"
        flag = " ⚠️" if "UNKLAR" in r["anmerkung"].upper() or "PRUEFEN" in r["anmerkung"].upper() else ""
        typ = r["typ"] + (" 💶" if r["typ"] == "Abhebung" else "")
        trows2.append([r["nr"], r["datum"], r["zeit"] or "–", typ, r["ort"], r["haendler"],
                       r["kategorie"] or "–", fw, eur(betrag_eur), r["zahler"], r["zahlmittel"],
                       kurs or "–", (r["anmerkung"] or "–") + flag])
    lines.append(md_table(header2, trows2))
    lines.append("")
    lines.append(f"**Echte Ausgaben:** {eur(aus_sum)} (davon bar {eur(bar_sum)}) · "
                  f"**Bargeldabhebungen:** {eur(abh_sum)} · **Kassenbestand:** {eur(abh_sum - bar_sum)}")
    lines.append("")

    # ---------------- Blatt 3: Zusammenfassung
    lines.append("## 3. Zusammenfassung")
    lines.append("")
    lines.append("### Kosten nach Kategorie")
    lines.append("")
    kat = collections.Counter()
    for r in b1:
        kat[r["kategorie"]] += num(r["betrag_eur"])
    for r in b2:
        if r["typ"] == "Ausgabe":
            kat[r["kategorie"] or "Sonstiges"] += num(r["betrag_eur"])
    ktable = [[k, eur(v)] for k, v in sorted(kat.items(), key=lambda x: -x[1]) if v]
    gesamt = sum(kat.values())
    lines.append(md_table(["Kategorie", "Betrag"], ktable))
    lines.append("")
    lines.append(f"**Gesamtausgaben: {eur(gesamt)}**")
    lines.append("")

    lines.append("### Wer hat wie viel getragen")
    lines.append("")
    pv = sum(num(r["bezahlt_eur"]) for r in b1 if r["zahler"] == "Patrick")
    nv = sum(num(r["bezahlt_eur"]) for r in b1 if r["zahler"] == "Nora")
    pl = sum(num(r["betrag_eur"]) for r in b2 if r["typ"] == "Ausgabe" and r["zahler"] == "Patrick")
    nl = sum(num(r["betrag_eur"]) for r in b2 if r["typ"] == "Ausgabe" and r["zahler"] == "Nora")
    tbd_v = sum(num(r["bezahlt_eur"]) + num(r["offen_eur"]) for r in b1 if r["zahler"] == "TBD")
    lines.append(md_table(
        ["Person", "Vorab (Blatt 1)", "Laufend (Blatt 2)", "Gesamt"],
        [["Patrick", eur(pv), eur(pl), eur(pv + pl)],
         ["Nora", eur(nv), eur(nl), eur(nv + nl)],
         ["Noch ungeklärt (TBD)", eur(tbd_v), "–", eur(tbd_v)]]))
    lines.append("")

    lines.append("### Reisekasse (Bargeld)")
    lines.append("")
    lines.append(f"- Abgehoben gesamt: **{eur(abh_sum)}**")
    lines.append(f"- Davon bar ausgegeben: **{eur(bar_sum)}**")
    lines.append(f"- Kassenbestand rechnerisch: **{eur(abh_sum - bar_sum)}**")
    lines.append("")

    lines.append("### Verrechnung zwischen Patrick und Nora")
    lines.append("")
    transfer = sum(num(v["betrag_eur"]) for v in b3)
    for v in b3:
        lines.append(f"- {v['datum']}: **{v['von']} → {v['nach']}**, {eur(num(v['betrag_eur']))} "
                      f"— {v['zweck']} ({v['anmerkung']})")
    lines.append("")
    beitrag_p = pv + pl + transfer
    beitrag_n = nv + nl
    anteil = gesamt / 2
    saldo_ohne = pv + pl - anteil
    saldo_mit = beitrag_p - anteil
    lines.append(md_table(
        ["", "Betrag"],
        [["Beitrag Patrick (Karte + Kasse + Überweisung)", eur(beitrag_p)],
         ["Beitrag Nora (Karte)", eur(beitrag_n)],
         ["Gesamtausgaben", eur(gesamt)],
         ["Anteil je Person (50/50)", eur(anteil)],
         ["Saldo Patrick ohne Überweisung", eur(saldo_ohne)],
         ["**Saldo Patrick inkl. 2.000-€-Überweisung**", f"**{eur(saldo_mit)}**"]]))
    lines.append("")
    lines.append("*Lesehilfe: Die 2.000 € sind noch weitgehend ungenutztes Guthaben bei Nora, "
                  "keine Ausgabe. Sobald Nora damit gemeinsame Kosten zahlt, sinkt der Saldo "
                  "automatisch – neue Zeilen dazu in `data/02_laufend.csv` mit Zahler `Nora`.*")
    lines.append("")

    lines.append("### Offene Punkte (⚠️ markiert)")
    lines.append("")
    lines.append("Siehe `docs/offene-punkte.md` für die vollständige, kommentierte Liste.")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("geschrieben:", OUT)


if __name__ == "__main__":
    main()
