#!/usr/bin/env python3
"""Baut aus data/*.csv eine .xlsx mit 3 Tabs fuer den Import in Google Sheets.

Aufruf:  python3 scripts/build_sheet.py
Ergebnis: build/Namibia_2026_Kosten.xlsx
"""
import csv
import pathlib

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "build" / "Namibia_2026_Kosten.xlsx"

KATEGORIEN = ["Flug", "Mietwagen", "Unterkunft", "Tanken", "Lebensmittel",
              "Restaurant", "Eintritt", "Aktivitäten", "Ausrüstung",
              "Gebühren", "Shopping", "Sonstiges", "Bargeld"]
ZAHLER = ["Patrick", "Nora", "Kasse", "TBD"]
ZAHLMITTEL = ["Oberbank Debit", "Mastercard card complete", "N26 Debit",
              "Bargeld", "Ueberweisung", "TBD"]

SH1, SH2, SH3 = "01 Bezahlt", "02 Laufend", "03 Zusammenfassung"

HEAD_FILL = PatternFill("solid", fgColor="1F3B4D")
HEAD_FONT = Font(color="FFFFFF", bold=True, size=10)
TITLE_FONT = Font(bold=True, size=14, color="1F3B4D")
SECTION_FONT = Font(bold=True, size=11, color="1F3B4D")
SECTION_FILL = PatternFill("solid", fgColor="E8EEF2")
WARN_FILL = PatternFill("solid", fgColor="FFF3CD")
TOTAL_FILL = PatternFill("solid", fgColor="D5E8D4")
EUR = '#,##0.00 "€"'
THIN = Side(style="thin", color="C9D2D8")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def read_csv(name):
    with open(DATA / name, encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def num(value):
    """CSV-Wert -> float, leer/TBD -> None."""
    if value is None or value.strip() in ("", "TBD"):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def style_header(ws, row, ncols):
    for col in range(1, ncols + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = HEAD_FILL
        cell.font = HEAD_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 30


def set_widths(ws, widths):
    for idx, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = width


def add_dropdown(ws, options, col_letter, first, last):
    dv = DataValidation(type="list", formula1='"%s"' % ",".join(options),
                        allow_blank=True, showDropDown=False)
    ws.add_data_validation(dv)
    dv.add("%s%d:%s%d" % (col_letter, first, col_letter, last))


# ---------------------------------------------------------------- Blatt 1
def build_bezahlt(wb):
    rows = read_csv("01_bezahlt.csv")
    ws = wb.create_sheet(SH1)
    ws["A1"] = "Bereits gebuchte & bezahlte Kosten (Vorab-/Fixkosten)"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = ("Flug, Mietwagen und alle Unterkünfte. Spalte »bezahlt« zählt nur "
                "tatsächlich geflossenes Geld, »offen« ist noch fällig.")
    ws["A2"].font = Font(italic=True, size=9, color="666666")

    header = ["Nr", "Datum", "Kategorie", "Beschreibung", "Nächte", "Betrag €",
              "Status", "bezahlt €", "offen €", "Zahler", "Zahlmittel", "Anmerkung"]
    ws.append([])
    ws.append(header)
    hrow = ws.max_row
    style_header(ws, hrow, len(header))

    first = hrow + 1
    for r in rows:
        ws.append([
            int(r["nr"]), r["datum"], r["kategorie"], r["beschreibung"],
            num(r["naechte"]), num(r["betrag_eur"]), r["status"],
            num(r["bezahlt_eur"]), num(r["offen_eur"]), r["zahler"],
            r["zahlmittel"], r["anmerkung"],
        ])
    last = ws.max_row

    for row in ws.iter_rows(min_row=first, max_row=last, max_col=len(header)):
        for cell in row:
            cell.border = BOX
            cell.alignment = Alignment(vertical="top", wrap_text=cell.column == 12)
            if cell.column in (6, 8, 9):
                cell.number_format = EUR
        if row[9].value == "TBD" or "UNKLAR" in str(row[11].value).upper():
            for cell in row:
                cell.fill = WARN_FILL

    total = last + 1
    ws.cell(row=total, column=4, value="SUMME")
    for col in (6, 8, 9):
        c = ws.cell(row=total, column=col,
                    value="=SUM(%s%d:%s%d)" % (get_column_letter(col), first,
                                               get_column_letter(col), last))
        c.number_format = EUR
    for col in range(1, len(header) + 1):
        cell = ws.cell(row=total, column=col)
        cell.fill = TOTAL_FILL
        cell.font = Font(bold=True)
        cell.border = BOX

    ws.auto_filter.ref = "A%d:L%d" % (hrow, last)
    ws.freeze_panes = "A%d" % first
    set_widths(ws, [5, 12, 14, 38, 8, 12, 24, 12, 12, 11, 22, 48])
    add_dropdown(ws, KATEGORIEN, "C", first, last + 40)
    add_dropdown(ws, ZAHLER, "J", first, last + 40)
    add_dropdown(ws, ZAHLMITTEL, "K", first, last + 40)
    return first, last


# ---------------------------------------------------------------- Blatt 2
def build_laufend(wb):
    rows = read_csv("02_laufend.csv")
    ws = wb.create_sheet(SH2)
    ws["A1"] = "Laufende Kosten während der Reise"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = ("Typ »Ausgabe« = echte Kosten. Typ »Abhebung« = Umbuchung in die "
                "Reisekasse (keine Ausgabe!). Kurs = Fremdwährung ÷ Euro.")
    ws["A2"].font = Font(italic=True, size=9, color="666666")

    header = ["Nr", "Datum", "Zeit", "Typ", "Ort", "Händler", "Kategorie",
              "Betrag FW", "Währung", "Betrag €", "Zahler", "Zahlmittel",
              "Kurs NAD/€", "Anmerkung"]
    ws.append([])
    ws.append(header)
    hrow = ws.max_row
    style_header(ws, hrow, len(header))

    first = hrow + 1
    for r in rows:
        ws.append([
            int(r["nr"]), r["datum"], r["zeit"], r["typ"], r["ort"], r["haendler"],
            r["kategorie"], num(r["betrag_fw"]), r["waehrung"], num(r["betrag_eur"]),
            r["zahler"], r["zahlmittel"], None, r["anmerkung"],
        ])
    last = ws.max_row

    # Leerzeilen zum Weiterschreiben unterwegs
    empty_to = last + 60
    for _ in range(60):
        ws.append([None] * len(header))

    for row in ws.iter_rows(min_row=first, max_row=empty_to, max_col=len(header)):
        rn = row[0].row
        for cell in row:
            cell.border = BOX
            cell.alignment = Alignment(vertical="top", wrap_text=cell.column == 14)
            if cell.column in (8, 10):
                cell.number_format = '#,##0.00'
            if cell.column == 10:
                cell.number_format = EUR
        row[12].value = '=IF(AND(H{r}<>"",J{r}<>"",J{r}<>0),H{r}/J{r},"")'.format(r=rn)
        row[12].number_format = '0.000'
        if "UNKLAR" in str(row[13].value).upper():
            for cell in row:
                cell.fill = WARN_FILL

    total = empty_to + 1
    ws.cell(row=total, column=6, value="SUMME echte Ausgaben (Typ = Ausgabe)")
    c = ws.cell(row=total, column=10,
                value='=SUMIFS(J{f}:J{l},D{f}:D{l},"Ausgabe")'.format(f=first, l=empty_to))
    c.number_format = EUR
    for col in range(1, len(header) + 1):
        cell = ws.cell(row=total, column=col)
        cell.fill = TOTAL_FILL
        cell.font = Font(bold=True)
        cell.border = BOX

    ws.auto_filter.ref = "A%d:N%d" % (hrow, empty_to)
    ws.freeze_panes = "A%d" % first
    set_widths(ws, [5, 12, 7, 11, 18, 26, 14, 12, 9, 12, 11, 22, 11, 46])
    add_dropdown(ws, ["Ausgabe", "Abhebung", "Transfer"], "D", first, empty_to)
    add_dropdown(ws, KATEGORIEN, "G", first, empty_to)
    add_dropdown(ws, ["NAD", "EUR", "ZAR"], "I", first, empty_to)
    add_dropdown(ws, ZAHLER, "K", first, empty_to)
    add_dropdown(ws, ZAHLMITTEL, "L", first, empty_to)
    return first, empty_to


# ---------------------------------------------------------------- Blatt 3
def build_summary(wb, r1, r2):
    b1f, b1l = r1
    b2f, b2l = r2
    verr = read_csv("03_verrechnung.csv")
    transfer = sum(num(v["betrag_eur"]) or 0 for v in verr)

    ws = wb.create_sheet(SH3)
    ws["A1"] = "Zusammenfassung Namibia 2026"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = "Alle Werte sind Formeln – sie aktualisieren sich, sobald du auf Blatt 1 oder 2 etwas änderst."
    ws["A2"].font = Font(italic=True, size=9, color="666666")

    S1 = "'%s'" % SH1
    S2 = "'%s'" % SH2
    # Bereiche
    k1 = "{s}!C{f}:C{l}".format(s=S1, f=b1f, l=b1l)   # Kategorie Blatt 1
    v1 = "{s}!F{f}:F{l}".format(s=S1, f=b1f, l=b1l)   # Betrag Blatt 1
    p1 = "{s}!H{f}:H{l}".format(s=S1, f=b1f, l=b1l)   # bezahlt Blatt 1
    o1 = "{s}!I{f}:I{l}".format(s=S1, f=b1f, l=b1l)   # offen Blatt 1
    z1 = "{s}!J{f}:J{l}".format(s=S1, f=b1f, l=b1l)   # Zahler Blatt 1
    k2 = "{s}!G{f}:G{l}".format(s=S2, f=b2f, l=b2l)
    v2 = "{s}!J{f}:J{l}".format(s=S2, f=b2f, l=b2l)
    t2 = "{s}!D{f}:D{l}".format(s=S2, f=b2f, l=b2l)   # Typ
    z2 = "{s}!K{f}:K{l}".format(s=S2, f=b2f, l=b2l)   # Zahler
    m2 = "{s}!L{f}:L{l}".format(s=S2, f=b2f, l=b2l)   # Zahlmittel

    row = 4

    def section(title, note=""):
        nonlocal row
        row += 1
        ws.cell(row=row, column=1, value=title).font = SECTION_FONT
        for col in range(1, 6):
            ws.cell(row=row, column=col).fill = SECTION_FILL
        if note:
            ws.cell(row=row, column=6, value=note).font = Font(italic=True, size=9, color="666666")
        row += 1

    def line(label, formula=None, bold=False, fmt=EUR, note=""):
        nonlocal row
        c_label = ws.cell(row=row, column=1, value=label)
        if formula is not None:
            c_val = ws.cell(row=row, column=3, value=formula)
            c_val.number_format = fmt
            if bold:
                c_val.font = Font(bold=True)
        if bold:
            c_label.font = Font(bold=True)
        if note:
            ws.cell(row=row, column=5, value=note).font = Font(italic=True, size=9, color="666666")
        row += 1

    # --- Kategorien
    section("Kosten nach Kategorie", "Vorab = Blatt 01, Laufend = Blatt 02 (nur Typ »Ausgabe«)")
    ws.cell(row=row, column=1, value="Kategorie")
    ws.cell(row=row, column=2, value="Vorab €")
    ws.cell(row=row, column=3, value="Laufend €")
    ws.cell(row=row, column=4, value="Gesamt €")
    style_header(ws, row, 4)
    row += 1
    kat_first = row
    for kat in [k for k in KATEGORIEN if k != "Bargeld"]:
        ws.cell(row=row, column=1, value=kat).border = BOX
        a = ws.cell(row=row, column=2, value='=SUMIF({k},A{r},{v})'.format(k=k1, r=row, v=v1))
        b = ws.cell(row=row, column=3,
                    value='=SUMIFS({v},{k},A{r},{t},"Ausgabe")'.format(v=v2, k=k2, t=t2, r=row))
        c = ws.cell(row=row, column=4, value="=B{r}+C{r}".format(r=row))
        for cell in (a, b, c):
            cell.number_format = EUR
            cell.border = BOX
        row += 1
    kat_last = row - 1
    ws.cell(row=row, column=1, value="GESAMT").font = Font(bold=True)
    for col in "BCD":
        cell = ws.cell(row=row, column="ABCD".index(col) + 1,
                       value="=SUM({c}{f}:{c}{l})".format(c=col, f=kat_first, l=kat_last))
        cell.number_format = EUR
        cell.font = Font(bold=True)
        cell.fill = TOTAL_FILL
        cell.border = BOX
    ws.cell(row=row, column=1).fill = TOTAL_FILL
    gesamt_row = row
    row += 2

    # --- Zahlungsstand
    section("Zahlungsstand Vorabkosten")
    line("bereits bezahlt", "=SUM({p})".format(p=p1))
    line("noch offen", "=SUM({o})".format(o=o1), note="davon einige bar vor Ort fällig")
    offen_row = row - 1
    row += 1

    # --- Wer hat gezahlt
    section("Wer hat wie viel getragen", "»Kasse« = bar aus der gemeinsamen Reisekasse")
    line("Patrick – Vorabkosten", '=SUMIF({z},"Patrick",{p})'.format(z=z1, p=p1))
    p_vor = row - 1
    line("Patrick – laufend (Karte)",
         '=SUMIFS({v},{z},"Patrick",{t},"Ausgabe")'.format(v=v2, z=z2, t=t2))
    p_lauf = row - 1
    line("Nora – Vorabkosten", '=SUMIF({z},"Nora",{p})'.format(z=z1, p=p1))
    n_vor = row - 1
    line("Nora – laufend (Karte)",
         '=SUMIFS({v},{z},"Nora",{t},"Ausgabe")'.format(v=v2, z=z2, t=t2))
    n_lauf = row - 1
    line("aus Reisekasse (bar)",
         '=SUMIFS({v},{z},"Kasse",{t},"Ausgabe")'.format(v=v2, z=z2, t=t2),
         note="Einleger der Kasse: siehe Abschnitt Reisekasse")
    kasse_row = row - 1
    line("noch ungeklärt (TBD)",
         '=SUMIF({z},"TBD",{p})+SUMIFS({v},{z},"TBD",{t},"Ausgabe")'.format(
             z=z1, p=p1, v=v2, t=t2),
         note="muss auf Patrick oder Nora aufgelöst werden")
    tbd_row = row - 1
    row += 1

    # --- Reisekasse
    section("Reisekasse (Bargeld)", "Abhebungen sind keine Ausgaben – nur Umbuchung")
    line("abgehoben gesamt", '=SUMIFS({v},{t},"Abhebung")'.format(v=v2, t=t2))
    abh_row = row - 1
    line("davon bar ausgegeben",
         '=SUMIFS({v},{t},"Ausgabe",{m},"Bargeld")'.format(v=v2, t=t2, m=m2))
    bar_row = row - 1
    line("Kassenbestand rechnerisch", "=C{a}-C{b}".format(a=abh_row, b=bar_row), bold=True)
    kb_row = row - 1
    line("Kassenbestand tatsächlich", None, note="hier den gezählten Bestand eintragen →")
    ws.cell(row=row - 1, column=3).number_format = EUR
    ws.cell(row=row - 1, column=3).fill = WARN_FILL
    ws.cell(row=row - 1, column=3).border = BOX
    row += 1

    # --- Verrechnung
    section("Verrechnung zwischen Patrick und Nora")
    for v in verr:
        line("Überweisung {} → {} ({})".format(v["von"], v["nach"], v["datum"]),
             num(v["betrag_eur"]), note=v["zweck"])
    trans_row = row - 1
    line("Beitrag Patrick (Karte + Kasse + Überweisung)",
         "=C{a}+C{b}+C{c}+C{d}".format(a=p_vor, b=p_lauf, c=kasse_row, d=trans_row),
         note="Kasse zählt zu Patrick, solange nur er abhebt")
    beitrag_p = row - 1
    line("Beitrag Nora (Karte)", "=C{a}+C{b}".format(a=n_vor, b=n_lauf))
    beitrag_n = row - 1
    line("Gesamtausgaben", "=D{g}".format(g=gesamt_row))
    ges_row = row - 1
    line("Anteil je Person (50/50)", "=C{g}/2".format(g=ges_row))
    anteil_row = row - 1
    line("Saldo Patrick ohne Überweisung",
         "=C{b}-C{t}-C{a}".format(b=beitrag_p, t=trans_row, a=anteil_row),
         note="rein aus getragenen Kosten – so viel hat Patrick zu viel bezahlt")
    line("Saldo Patrick gesamt", "=C{b}-C{a}".format(b=beitrag_p, a=anteil_row), bold=True,
         note="positiv = Nora hält/schuldet diesen Betrag")
    ws.cell(row=row - 1, column=3).fill = TOTAL_FILL
    row += 1
    ws.cell(row=row, column=1,
            value=("Lesehilfe: Die 2.000 € sind noch weitgehend ungenutztes Guthaben bei Nora, "
                   "keine Ausgabe. Sobald Nora damit gemeinsame Kosten zahlt, sinkt der Saldo "
                   "automatisch – Zeilen dazu einfach in Blatt 02 mit Zahler »Nora« erfassen.")
            ).font = Font(italic=True, size=9, color="666666")
    row += 2

    # --- Hinweise
    section("Offene Punkte")
    for txt in [
        "Mietwagen: 2.805,00 € (aktueller Tab) vs. 2.605,03 € (Altversion) – welcher Betrag stimmt?",
        "Welche Karte wurde am Flughafen und bei Superspar/Agrimark benutzt (Oberbank Debit oder card complete)?",
        "Agrimark Rehoboth 73,42 € – was wurde gekauft? (Kategorie derzeit »Ausrüstung«)",
        "Datum der 2.000-€-Überweisung an Nora fehlt.",
        "Zahlungsstatus Granietkop, Onguma (2 Nächte) und Anzahlungshöhe Hoada unklar.",
        "Kalahari und Quiver Tree: Nächte sind vorbei – wer hat wie bezahlt?",
        "card complete: OGH-Urteil 01/2026 – unzulässige Fremdwährungsgebühren rückforderbar.",
    ]:
        ws.cell(row=row, column=1, value="•  " + txt)
        row += 1

    set_widths(ws, [46, 16, 16, 4, 40, 60])
    return ws


def main():
    wb = Workbook()
    wb.remove(wb.active)
    r1 = build_bezahlt(wb)
    r2 = build_laufend(wb)
    build_summary(wb, r1, r2)
    OUT.parent.mkdir(exist_ok=True)
    wb.save(OUT)
    print("geschrieben:", OUT)


if __name__ == "__main__":
    main()
