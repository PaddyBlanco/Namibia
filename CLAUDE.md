# CLAUDE.md — Namibia Roadtrip 2026

Arbeitskontext für Claude in diesem Repo. Bitte vor jeder Änderung lesen.

## Was dieses Repo ist

Kosten- und Reisedokumentation für den Namibia-Roadtrip **02.09. – 21.09.2026**
(Patrick + Nora). Das Repo ist die **Quelle der Wahrheit** für alle Kostendaten.
Das Google Sheet ist die Anzeige-/Arbeitsoberfläche und wird aus dem Repo erzeugt.

## Personen & Zahlungsmittel

| Person  | Karte                                    | Rolle im Kostenmodell |
|---------|------------------------------------------|-----------------------|
| Patrick | Oberbank Debitkarte                      | Girokonto, Standard für Bargeldabhebung |
| Patrick | Mastercard card complete World Superior  | Kreditkarte, nur Notfall/Kaution |
| Nora    | N26 Debit (Mastercard)                   | Standard für Kartenzahlungen |

**Kartenregel (siehe `docs/karten-gebuehren.md`):**
- Kartenzahlung in NAD → **Nora / N26** (0 % Fremdwährungsgebühr)
- Bargeld abheben → **Patrick / Oberbank Debit** (~0,5–1 % statt 3 % bei card complete)
- card complete Mastercard → nur Mietwagen-Kaution / Notfall, **nie** Bargeld
- An jedem Terminal: **immer in NAD abrechnen lassen, nie in EUR** (DCC-Falle)

## Grundregeln der Kostenerfassung

1. **Bargeldabhebung ist keine Ausgabe.** Sie ist eine Umbuchung in die Reisekasse
   (`Typ = Abhebung`). Nur das Behebungsentgelt zählt als Kosten (Kategorie `Gebühren`).
   Ausgegeben wird das Geld erst beim Bezahlen (`Typ = Ausgabe`, `Zahlmittel = Bargeld`).
2. **Interne Transfers** (z. B. Patrick → Nora 2.000 €) sind `Typ = Transfer`,
   nie Ausgabe. Sie beeinflussen nur die Ausgleichsrechnung.
3. **Jede Zeile braucht einen Zahler** (`Patrick` oder `Nora`). Unbekannt = `TBD`,
   niemals raten.
4. **Fremdwährung immer im Original erfassen** (Betrag NAD + Betrag EUR).
   Der effektive Kurs wird berechnet, nicht eingetragen.
5. **Unsichere Daten werden als `TBD` markiert**, nicht geschätzt. Annahmen gehören
   in die Spalte `Anmerkung` und ins Änderungsprotokoll unten.

## Kategorien (fix — nicht erweitern ohne Rücksprache)

`Flug`, `Mietwagen`, `Unterkunft`, `Tanken`, `Lebensmittel`, `Restaurant`,
`Eintritt`, `Aktivitäten`, `Ausrüstung`, `Gebühren`, `Shopping`, `Sonstiges`

## Dateien

| Pfad | Inhalt |
|------|--------|
| `data/01_bezahlt.csv`      | Vorab-/Fixkosten: Flug, Mietwagen, Unterkünfte inkl. Zahlungsstatus |
| `data/02_laufend.csv`      | Laufende Kosten während der Reise + Bargeldbewegungen |
| `data/03_verrechnung.csv`  | Interne Transfers zwischen Patrick und Nora |
| `docs/karten-gebuehren.md` | Recherche Kartenkonditionen + Handlungsempfehlung |
| `docs/offene-punkte.md`    | Was noch geklärt werden muss |
| `scripts/build_sheet.py`   | Baut aus den CSVs eine .xlsx mit 3 Tabs (Google-Sheets-tauglich) |

## Workflow bei neuen Belegen

1. Screenshot/Beleg auswerten → Zeile in die passende CSV eintragen (Zahler nicht vergessen)
2. `python3 scripts/build_sheet.py` → erzeugt `build/Namibia_2026_Kosten.xlsx`
3. Datei nach Google Drive hochladen (Konvertierung zu Google Sheet)
4. Committen und pushen auf `claude/namibia-2026-bkm6h4`

## Google Sheet

- Hauptsheet: `19ONck2pfgBvzi8dsNkwXYO7dFQyZN9uRk7ymKBBJCOE` ("Namibia 2026")
- **Einschränkung:** Der Google-Drive-Connector kann lesen und neue Dateien anlegen,
  aber **keine Tabs in ein bestehendes Sheet schreiben**. Ein Google-Sheets-Schreib-
  Connector existiert im Connector-Verzeichnis nicht. Ablauf daher:
  neues Sheet erzeugen → im Hauptsheet je Reiter Rechtsklick →
  *Kopieren nach* → *Vorhandene Tabelle*.

## Konventionen

- Beträge in CSV: Punkt als Dezimaltrennzeichen, keine Tausenderpunkte, ohne Währungszeichen
- Datum: `YYYY-MM-DD`
- Sprache aller Inhalte: Deutsch
- Antworten an den Nutzer: Deutsch, Empfehlung zuerst, keine Annahmen ohne Kennzeichnung
- Bei jeder Nutzernachricht: **aktuelles Datum und Uhrzeit per `date` holen** (auch Africa/Windhoek)
