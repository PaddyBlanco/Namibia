#!/usr/bin/env python3
"""Baut docs/kosten.md aus data/*.csv - schnelle, lesbare Markdown-Ansicht.

Aufruf: python3 scripts/build_md.py
Rechenlogik (Summen, Saldo) liegt in kosten_core.py, gemeinsam mit build_site_data.py.
"""
import pathlib

from kosten_core import compute, load, num, pruefe, warne

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "kosten.md"


def eur(v):
    return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def md_table(header, rows_):
    out = ["| " + " | ".join(header) + " |",
           "|" + "|".join(["---"] * len(header)) + "|"]
    for r in rows_:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def main():
    b1, b2, b3 = load()
    k = compute(b1, b2, b3)

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
    for r in b1:
        flag = " ⚠️" if r["zahler"] == "TBD" or "UNKLAR" in r["anmerkung"].upper() or "PRUEFEN" in r["anmerkung"].upper() else ""
        trows.append([r["nr"], r["datum"], r["kategorie"], r["beschreibung"],
                      r["naechte"] or "–", eur(num(r["betrag_eur"])), r["status"],
                      eur(num(r["bezahlt_eur"])), eur(num(r["offen_eur"])),
                      r["zahler"] + flag, r["zahlmittel"], r["anmerkung"] or "–"])
    lines.append(md_table(header, trows))
    lines.append("")
    lines.append(f"**Summe:** {eur(k['plan_sum'])} geplant · {eur(k['bez_sum'])} bezahlt · "
                 f"**{eur(k['off_sum'])} noch offen**")
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
    for r in b2:
        betrag_eur = num(r["betrag_eur"])
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
    lines.append(f"**Echte Ausgaben:** {eur(k['aus_sum'])} (davon bar {eur(k['kasse_bar_ausgegeben'])}) · "
                 f"**Bargeldabhebungen:** {eur(k['kasse_abgehoben'])} · "
                 f"**Kassenbestand:** {eur(k['kasse_bestand'])}")
    lines.append("")

    # ---------------- Blatt 3: Zusammenfassung
    lines.append("## 3. Zusammenfassung")
    lines.append("")
    lines.append("### Kosten nach Kategorie")
    lines.append("")
    lines.append(md_table(["Kategorie", "Betrag"], [[name, eur(v)] for name, v in k["kategorien"]]))
    lines.append("")
    lines.append(f"**Gesamtausgaben: {eur(k['gesamt'])}** "
                 f"(davon bezahlt {eur(k['bezahlt'])}, noch offen {eur(k['offen'])})")
    lines.append("")

    lines.append("### Wer hat wie viel gezahlt")
    lines.append("")
    pv = sum(num(r["bezahlt_eur"]) for r in b1 if r["zahler"] == "Patrick")
    nv = sum(num(r["bezahlt_eur"]) for r in b1 if r["zahler"] == "Nora")
    pl = k["patrick_gezahlt"] - pv
    nl = k["nora_gezahlt"] - nv
    lines.append(md_table(
        ["Person", "Vorab (Blatt 1)", "Laufend (Blatt 2)", "Gesamt"],
        [["Patrick", eur(pv), eur(pl), eur(k["patrick_gezahlt"])],
         ["Nora", eur(nv), eur(nl), eur(k["nora_gezahlt"])],
         ["Noch offen (zählt erst bei Bezahlung, dann beim Zahler)", "–", "–", eur(k["offen"])]]))
    lines.append("")

    lines.append("### Reisekasse (Bargeld)")
    lines.append("")
    lines.append(f"- Abgehoben gesamt: **{eur(k['kasse_abgehoben'])}**")
    lines.append(f"- Davon bar ausgegeben: **{eur(k['kasse_bar_ausgegeben'])}**")
    lines.append(f"- Kassenbestand rechnerisch: **{eur(k['kasse_bestand'])}**")
    for person, t in k["kasse"].items():
        nad = lambda v: f"{v:,.0f}".replace(",", ".")
        lines.append(f"  - Topf {person}: {nad(t['bestand_nad'])} NAD ≈ {eur(t['bestand_eur'])} "
                     f"(abgehoben {nad(t['abgehoben_nad'])} NAD zu {t['kurs']} NAD/€)")
    lines.append("- Barzahlungen werden dem ältesten Topf mit Deckung zugerechnet (Regel 9), "
                 "EUR zum Kurs des jeweiligen Topfs (Regel 7).")
    lines.append("")

    lines.append("### Verrechnung zwischen Patrick und Nora")
    lines.append("")
    for v in b3:
        lines.append(f"- {v['datum']}: **{v['von']} → {v['nach']}**, {eur(num(v['betrag_eur']))} "
                     f"— {v['zweck']} ({v['anmerkung']})")
    lines.append("")
    saldo = k["saldo_patrick"]
    saldo_text = (f"**Nora schuldet Patrick {eur(saldo)}**" if saldo > 0.005
                  else f"**Patrick schuldet Nora {eur(-saldo)}**" if saldo < -0.005
                  else "**Ausgeglichen**")
    lines.append(md_table(
        ["", "Betrag"],
        [["Patrick gezahlt (Karte + Bargeld)", eur(k["patrick_gezahlt"])],
         ["Nora gezahlt (Karte)", eur(k["nora_gezahlt"])],
         ["Überweisung Patrick → Nora", eur(k["transfer_patrick_nora"])],
         ["Bisher bezahlt gesamt (Saldo-Basis)", eur(k["saldo_basis"])],
         ["Anteil je Person (50 %)", eur(k["anteil_pro_person"])],
         ["Patrick effektiv getragen (gezahlt + Überweisung)", eur(k["beitrag_patrick"])],
         ["Nora effektiv getragen (gezahlt − Überweisung)", eur(k["beitrag_nora"])],
         ["**Saldo**", saldo_text]]))
    lines.append("")
    lines.append("*Lesehilfe: Der Saldo wird 50/50 auf das gerechnet, was bisher tatsächlich "
                 f"bezahlt wurde – die noch offenen {eur(k['offen'])} zählen erst, wenn jemand sie "
                 "bezahlt (dann beim Zahler). Ein negativer Wert bei „Nora effektiv getragen“ heißt: "
                 "von den 2.000 € Überweisung ist noch mehr übrig, als Nora selbst beigesteuert hat. "
                 "Jede neue Zahlung von Nora in `data/02_laufend.csv` senkt den Saldo automatisch.*")
    if k["tbd_gezahlt"] > 0.005:
        lines.append("")
        lines.append(f"⚠️ **{eur(k['tbd_gezahlt'])} sind bezahlt, aber ohne bekannten Zahler (TBD)** – "
                     "diese Beträge stehen außerhalb der Saldo-Basis, bis der Zahler geklärt ist.")
    lines.append("")

    lines.append("### Offene Punkte (⚠️ markiert)")
    lines.append("")
    lines.append("Siehe `docs/offene-punkte.md` für die vollständige, kommentierte Liste.")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("geschrieben:", OUT)
    warne(pruefe(b1, b2))


if __name__ == "__main__":
    main()
