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
   in die Spalte `Anmerkung`.
6. **Jede Zahlung steht genau einmal.** Eine Unterkunft, die vor Ort (bar oder Karte)
   bezahlt wird, gehört als Zahlung nach `02_laufend.csv`. Ihre Zeile in
   `01_bezahlt.csv` bleibt als Buchungsübersicht stehen, bekommt aber
   `betrag_eur = 0`, `offen_eur = 0` und einen Verweis in der Anmerkung —
   sonst zählt Blatt 3 den Posten doppelt.
7. **Barausgaben in EUR** werden mit dem Kurs bewertet, zu dem das Bargeld beschafft
   wurde (aktuell **18,633 NAD/€** aus der ATM-Abhebung vom 03.09.).

## Kategorien (fix — nicht erweitern ohne Rücksprache)

`Flug`, `Mietwagen`, `Unterkunft`, `Tanken`, `Lebensmittel`, `Restaurant`,
`Eintritt`, `Aktivitäten`, `Ausrüstung`, `Gebühren`, `Shopping`, `Sonstiges`

## Dateien

| Pfad | Inhalt |
|------|--------|
| `data/01_bezahlt.csv`      | Vorab-/Fixkosten: Flug, Mietwagen, Unterkünfte inkl. Zahlungsstatus |
| `data/02_laufend.csv`      | Laufende Kosten während der Reise + Bargeldbewegungen |
| `data/03_verrechnung.csv`  | Interne Transfers zwischen Patrick und Nora |
| `docs/kosten.md`           | **Primäre Ansicht** – automatisch aus den CSVs erzeugt, lesbar auf GitHub |
| `docs/karten-gebuehren.md` | Recherche Kartenkonditionen + Handlungsempfehlung |
| `docs/offene-punkte.md`    | Was noch geklärt werden muss |
| `scripts/build_md.py`      | Baut `docs/kosten.md` aus den CSVs (schnell, Standardweg) |
| `scripts/build_sheet.py`   | Baut zusätzlich eine .xlsx mit 3 Tabs – nur auf Zuruf, siehe unten |

## Workflow bei neuen Belegen

**Standardweg (schnell, während der Reise):**

1. Screenshot/Beleg auswerten → Zeile in die passende CSV eintragen (Zahler nicht vergessen)
2. `python3 scripts/build_md.py` → aktualisiert `docs/kosten.md`
3. Committen und pushen auf `claude/namibia-2026-bkm6h4`

Der Google-Sheet-Weg (xlsx bauen + hochladen) ist bewusst pausiert, weil er pro
Beleg mehrere Tool-Calls und eine manuelle Kopieraktion braucht — zu langsam für
unterwegs. Erst wieder aktivieren, wenn der Nutzer explizit danach fragt (siehe
`scripts/build_sheet.py` und Abschnitt „Google Sheet" unten).

## Google Sheet — bewusst nicht mehr benutzt

- Hauptsheet: `19ONck2pfgBvzi8dsNkwXYO7dFQyZN9uRk7ymKBBJCOE` ("Namibia 2026"), Eigentümerin
  Nora (norafhuber@gmail.com), Freigabe steht auf "jeder mit Link kann bearbeiten".
- **Technische Grenze, nicht Berechtigungsfrage:** Der verbundene Google-Drive-
  Connector kann Dateien lesen/suchen/neu anlegen (`create_file`, `copy_file`,
  `read_file_content`, `update_file` für Titel/Ordner, `share_file`), aber es gibt
  **keine Funktion, die Zellen oder Tabs in einem bestehenden Sheet ändert**.
  Das gilt unabhängig davon, wie das Sheet freigegeben ist. Ein separater
  Google-Sheets-Schreib-Connector ist im Connector-Verzeichnis nicht vorhanden.
  "Claude für Google Sheets" (die Workspace-Erweiterung, die man direkt in Sheets
  installiert) ist ein anderes Produkt und läuft nicht über diese Session.
- Nutzer hat sich am 06.09.2026 explizit für den Markdown-Weg entschieden
  (`docs/kosten.md`), weil der Sheet-Umweg (xlsx bauen → hochladen → manuell
  Tabs kopieren) zu langsam war. `scripts/build_sheet.py` bleibt im Repo falls
  später doch gebraucht, aber **nicht mehr automatisch ausführen**.

## Konventionen

- Beträge in CSV: Punkt als Dezimaltrennzeichen, keine Tausenderpunkte, ohne Währungszeichen
- Datum: `YYYY-MM-DD`
- Sprache aller Inhalte: Deutsch
- Antworten an den Nutzer: Deutsch, Empfehlung zuerst, keine Annahmen ohne Kennzeichnung
- Bei jeder Nutzernachricht: **aktuelles Datum und Uhrzeit per `date` holen** (auch Africa/Windhoek)
