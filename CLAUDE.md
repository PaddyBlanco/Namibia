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
| `data/04_tanken.csv`       | Tankvorgänge: Liter, Preis/Liter (NAD), km-Stand — ergänzt die `Tanken`-Zeilen aus `02_laufend.csv`, zählt selbst NICHT in die Summen |
| `data/fahrzeug.json`       | Mietwagen-Modell, Tankgröße, Herstellerverbrauch — für die Reichweitenberechnung |
| `data/tankstellen_hinweise.csv` | Recherchierte Tankstellen-Planung entlang der Route (statisch, kein Kostenbezug) |
| `docs/kosten.md`           | **Primäre Ansicht** – automatisch aus den CSVs erzeugt, lesbar auf GitHub |
| `docs/karten-gebuehren.md` | Recherche Kartenkonditionen + Handlungsempfehlung |
| `docs/offene-punkte.md`    | Was noch geklärt werden muss |
| `scripts/build_md.py`      | Baut `docs/kosten.md` aus den CSVs (schnell, Standardweg) |
| `scripts/build_sheet.py`   | Baut zusätzlich eine .xlsx mit 3 Tabs – nur auf Zuruf, siehe unten |
| `scripts/build_site_data.py` | Baut `docs/assets/data/site-data.json` für die GitHub-Pages-Seite |
| `docs/index.html` + `docs/assets/` | GitHub-Pages-Seite (Mobile-App-Stil), siehe Abschnitt „Website" unten |

## Workflow bei neuen Belegen

**Standardweg (schnell, während der Reise):**

1. Screenshot/Beleg auswerten → Zeile in die passende CSV eintragen (Zahler nicht vergessen)
2. `python3 scripts/build_md.py` → aktualisiert `docs/kosten.md`
3. `python3 scripts/build_site_data.py` → aktualisiert die Website-Daten
4. Committen und pushen auf `claude/namibia-2026-bkm6h4`

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

## Tanken

- **`data/04_tanken.csv` dupliziert keine Kosten** — jeder Tankvorgang steht
  bereits als `Ausgabe`/Kategorie `Tanken` in `data/02_laufend.csv`. Die
  Tanken-CSV ergänzt nur Liter, Preis/Liter (NAD) und Kilometerstand für
  dieselbe Zeile (verknüpft über Datum/Ort in der Anmerkung). Beim Eintragen
  neuer Tankbelege also **beide Dateien** pflegen: Betrag in `02_laufend.csv`,
  Details in `04_tanken.csv`.
- Verbrauch (L/100km) wird nur berechnet, wenn zwei **aufeinanderfolgende**
  Fill-ups beide einen Kilometerstand haben — sonst `null`, nie geschätzt.
- Reichweite (km) = Tankgröße ÷ Verbrauch × 100, nur wenn beides in
  `data/fahrzeug.json` bzw. aus echten Fill-ups bekannt ist. Solange das
  Fahrzeugmodell `"TBD"` ist, zeigt die Seite "Tankgröße fehlt noch".
- `data/tankstellen_hinweise.csv` ist recherchiertes Allgemeinwissen zur
  Route (Stand 06.09.2026, siehe Quellen im Chat-Verlauf), keine Live-Daten -
  bei Bedarf mit tatsächlicher Erfahrung vor Ort aktualisieren.

## Website (GitHub Pages, `docs/`)

- Mobile-first Single-Page-App, reines HTML/CSS/JS, **keine externen Libraries/CDNs**
  (funktioniert auch bei schlechtem Netz in Namibia; JSON wird zusätzlich in
  `localStorage` gecacht, damit die Seite auch offline zuletzt geladene Daten zeigt).
- 3 Tabs unten: **Kosten** (mit Sub-Nav „Kostenübersicht" [Stat-Kacheln,
  Saldo, Kategorien-Donut] und „Ausgabenliste" [filterbare Liste]),
  **Reiseplan** (Zeitleiste, heutiger Tag live aus dem Gerätedatum des
  Betrachters hervorgehoben), **Mehr** (Tanken, Verrechnung, offene Punkte).
  Sub-Nav-Umschaltung (`showSubView()` in `app.js`) ist reines Anzeigen/
  Verstecken, nicht in der URL kodiert (kein Deep-Link auf die Ausgabenliste).
  Die DOM-IDs der einzelnen Widgets (`#day-badge`, `#t-gesamt`,
  `#kategorien-donut`, `#ausgaben-list` usw.) sind unabhängig davon, in
  welchem Tab sie liegen — beim Umbauen der Navigation reicht es, das
  HTML zu verschieben, die Render-Funktionen in `app.js` bleiben gleich.
- **Repo ist öffentlich** (Statuswechsel von privat → öffentlich am 06.09.2026,
  vom Nutzer bestätigt/gewollt). Damit sind CSVs, Saldo und alle Beträge
  ohnehin schon über die normale GitHub-Dateiansicht für jeden einsehbar,
  unabhängig von Pages — die Website macht es nur bequemer lesbar, nicht
  öffentlicher. Konsequenzen:
  - **Nie Buchungslinks/Tokens ins JSON oder in die CSVs übernehmen** —
    unabhängig von der Sichtbarkeit, das war schon immer Regel.
  - `<meta name="robots" content="noindex, nofollow">` bleibt in `index.html`
    (verhindert Auffindbarkeit über Suchmaschinen, aber keinen direkten
    Zugriffsschutz — bei öffentlichem Repo ohnehin nicht relevant für die
    Rohdaten, nur für die Pages-Seite selbst).
  - Falls der Nutzer das Repo je wieder auf privat stellt: nur der Owner kann
    das unter Settings → General → Danger Zone → Change visibility. Auf
    GitHub Free ist eine Pages-Seite aus einem *privaten* Repo dann trotzdem
    für jeden mit der URL erreichbar (kein automatischer Zugriffsschutz ohne
    GitHub Pro/Team).
- `scripts/build_site_data.py` ist die einzige Quelle für `site-data.json` —
  nie von Hand editieren, parst auch die Tabelle unter „## Blockierend für
  korrekte Zahlen" aus `docs/offene-punkte.md`.
- GitHub-Pages-Einstellung (macht der Nutzer selbst): Settings → Pages →
  Source: *Deploy from branch* → Branch **`claude/namibia-2026-bkm6h4`**
  (Stand 06.09.2026: `main` enthält nur die Start-README, die gesamte
  Website liegt ausschließlich im Feature-Branch) → Ordner `/docs`.
- **Ausgaben-Tab zeigt Zahlmittel statt „bezahlt".** Ein bezahlter Posten
  bekommt statt der Status-Pille „bezahlt" die Kurzform des Zahlmittels
  (`mapZahlmittel()` in `app.js`): `Bargeld`→Bar, alles mit `N26`→N26,
  `card complete`/„Kredit"→Kredit, alles andere mit „Debit"→Debit
  (= Patricks Oberbank). `TBD` bleibt `TBD` (nie raten). Die Pille „offen"
  bleibt für noch nicht bezahlte Posten erhalten — Status hat Vorrang vor
  Zahlmittel. Neue Zahlmittel-Werte in den CSVs ggf. in `mapZahlmittel()`
  ergänzen, sonst erscheinen sie 1:1 als Fallback-Text.

## Konventionen

- Beträge in CSV: Punkt als Dezimaltrennzeichen, keine Tausenderpunkte, ohne Währungszeichen
- Datum: `YYYY-MM-DD`
- Sprache aller Inhalte: Deutsch
- Antworten an den Nutzer: Deutsch, Empfehlung zuerst, keine Annahmen ohne Kennzeichnung
- Bei jeder Nutzernachricht: **aktuelles Datum und Uhrzeit per `date` holen** (auch Africa/Windhoek)
