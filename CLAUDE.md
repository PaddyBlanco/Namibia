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
8. **Saldo-Definition (seit 07.09.2026, `scripts/kosten_core.py`):** 50/50 auf
   Basis dessen, was **bisher nachweislich von Patrick oder Nora bezahlt** wurde
   (`saldo_basis`). Noch offene Posten gehören niemandem, bis sie jemand bezahlt;
   Zahlungen mit `zahler = TBD` bleiben außerhalb der Basis. Die 2.000-€-Überweisung
   zählt bei Patrick plus, bei Nora minus („effektiv getragen"). Vorher wurde der
   Anteil auf die Gesamtsumme *inkl. offen* gerechnet — das unterstellte still-
   schweigend, dass Nora alle offenen Posten zahlt, und wies Noras Beitrag ohne
   Abzug der Überweisung aus (Summe der Beiträge lag 2.000 € über dem Bezahlten).
   `build_md.py` und `build_site_data.py` rechnen **beide** über `kosten_core.compute()`
   — Zahlenlogik nie in einem der beiden Skripte allein ändern.
9. **Bargeld gehört dem Abhebenden.** Die Reisekasse stammt aus Patricks
   ATM-Abhebung — jede Zeile mit `zahlmittel = Bargeld` bekommt deshalb
   `zahler = Patrick`, auch wenn Nora physisch bezahlt hat. Sonst würde
   Patricks Geld Nora gutgeschrieben und der Saldo kippt. `kosten_core.pruefe()`
   warnt bei beiden Build-Skripten auf stderr, wenn ein Barzahler nicht
   abgehoben hat oder ein Zahler-Wert weder `Patrick`, `Nora` noch `TBD` ist
   (Tippfehler wie `patrick` fallen sonst stillschweigend aus der Saldo-Basis).

## Kategorien (fix — nicht erweitern ohne Rücksprache)

`Flug`, `Mietwagen`, `Unterkunft`, `Tanken`, `Lebensmittel`, `Restaurant`,
`Eintritt`, `Aktivitäten`, `Ausrüstung`, `Gebühren`, `Shopping`, `Sonstiges`

## Dateien

| Pfad | Inhalt |
|------|--------|
| `data/01_bezahlt.csv`      | Vorab-/Fixkosten: Flug, Mietwagen, Unterkünfte inkl. Zahlungsstatus, `info_link` (Google-Maps-Suchlink) und `fahrzeit` (Anfahrt zu dieser Unterkunft) |
| `data/02_laufend.csv`      | Laufende Kosten während der Reise + Bargeldbewegungen |
| `data/03_verrechnung.csv`  | Interne Transfers zwischen Patrick und Nora |
| `data/04_tanken.csv`       | Tankvorgänge: Liter, Preis/Liter (NAD), km-Stand, `volltanken` (ja/nein/TBD) — ergänzt die `Tanken`-Zeilen aus `02_laufend.csv`, zählt selbst NICHT in die Summen |
| `data/fahrzeug.json`       | Mietwagen-Modell, Tankgröße, Herstellerverbrauch — für die Reichweitenberechnung |
| `data/tankstellen_hinweise.csv` | Recherchierte Tankstellen-Planung entlang der Route (statisch, kein Kostenbezug) |
| `data/tankplanung.json`    | Manuell gepflegte Momentaufnahme "wo als Nächstes tanken" (siehe Abschnitt Tanken) |
| `docs/kosten.md`           | **Primäre Ansicht** – automatisch aus den CSVs erzeugt, lesbar auf GitHub |
| `docs/karten-gebuehren.md` | Recherche Kartenkonditionen + Handlungsempfehlung |
| `docs/offene-punkte.md`    | Was noch geklärt werden muss |
| `docs/handover.md`         | Projektstand-Übergabe: was fertig ist, was offen ist, wie es weitergeht |
| `scripts/kosten_core.py`   | **Gemeinsame Rechenlogik** (Summen, Kategorien, Saldo) für beide Build-Skripte — einzige Stelle für Zahlenlogik |
| `scripts/build_md.py`      | Baut `docs/kosten.md` aus den CSVs (schnell, Standardweg) |
| `scripts/build_sheet.py`   | Baut zusätzlich eine .xlsx mit 3 Tabs – nur auf Zuruf, siehe unten |
| `scripts/build_site_data.py` | Baut `docs/assets/data/site-data.json` für die GitHub-Pages-Seite und stempelt `?v=<hash>` an `app.js`/`style.css` in `index.html` (Cache-Busting, s. Website) |
| `docs/index.html` + `docs/assets/` | GitHub-Pages-Seite (Mobile-App-Stil), siehe Abschnitt „Website" unten |
| `docs/sw.js`               | Service Worker für Offline-Fähigkeit (App-Shell + Kostendaten aus dem Cache) - `CACHE_VERSION`/Dateinamen werden von `build_site_data.py` gestempelt, nicht von Hand editieren |

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

## CSV-Fallstrick: Kommas in Anmerkungen

Am 06.09.2026 gefunden: Ein unquotiertes Komma in einer `anmerkung` (Flug-
Zeile) hat die CSV stillschweigend zerlegt — `csv.DictReader` hat den Rest
nach dem Komma in einen `None`-Restkey gepackt, wodurch der Text ab dort in
`docs/kosten.md` und `site-data.json` fehlte, ohne Fehler. **Deshalb: CSVs
nie mehr per Hand mit Kommas in Freitextfeldern schreiben** — entweder das
Feld in Anführungszeichen setzen (`"Text, mit Komma"`) oder (sicherer) mit
Pythons `csv`-Modul (`csv.DictWriter`) schreiben, das automatisch quotet.
Vor jeder groesseren CSV-Aenderung zur Sicherheit gegenpruefen:
`python3 -c "import csv; [print(i+2,r) for i,r in enumerate(csv.DictReader(open('data/01_bezahlt.csv'))) if None in r]"`

## Unterkunfts-Links (`info_link`)

- Jede Unterkunft in `data/01_bezahlt.csv` hat eine `info_link`-Spalte mit
  einem **Google-Maps-Suchlink** (`https://www.google.com/maps/search/?api=1&query=<Name>+Namibia`,
  URL-encodiert) — Nutzerwunsch 06.09.2026: „nur den allgemeinen Link, dass
  ich nachschauen kann wie es aussieht, Google Maps Standort mit Bildern,
  kein Buchungslink". Bewusst eine **Such**-URL statt fest codierter
  Koordinaten/Place-ID: Maps löst den Namen selbst auf, kein Risiko eines
  falschen Orts durch recherchierte-aber-falsche Koordinaten.
  Frühere Version verlinkte offizielle Websites/Tracks4Africo — auf
  Nutzerwunsch durch Maps-Links ersetzt.
- **Nie die persönliche Buchungsbestätigung verlinken** (die aus dem alten
  Google Sheet enthielten `auth_key=`/`sid=`-Tokens) — das Repo ist
  öffentlich, ein Token in einer URL wäre wie ein offenliegendes Passwort.
- Wird in der Website unter „Alle Unterkünfte" (Home) als „Google Maps ↗"
  verlinkt und fließt über `data.plan` (aus `build_site_data.py`) ins JSON.
- Neu erfasste Unterkünfte: `info_link` immer im selben Muster setzen,
  nie eine andere Linkart (Buchungsseite, Blog, Social Media) einsetzen.

## Fahrzeiten (`fahrzeit` in `01_bezahlt.csv`)

- Die Spalte `fahrzeit` ist die **Anfahrt ZU dieser Unterkunft**, nicht die
  Weiterfahrt. Bei der 2. Onguma-Nacht deshalb leer (kein Ortswechsel),
  bei Flug/Mietwagen ebenfalls leer.
- **Herkunft der Werte:** Die meisten stammen aus der „Fahrzeit"-Spalte des
  ursprünglichen Google Sheets (3h, 2h, 1h15, 5–7h …). Zwei fehlten dort
  bzw. standen auf `#ERROR!` und wurden am 06.09.2026 recherchiert — sie
  sind mit `ca.` gekennzeichnet:
  - Hoada → Okaukuejo: **ca. 3h30** (~300 km via C40/C38 und Anderson Gate)
  - Waterberg → Omatozu: **ca. 2h30** (~215 km, überwiegend B1;
    Omatozu liegt 25 km nördlich von Okahandja)
- Angezeigt an drei Stellen: „Nächstes Ziel" auf Home, in der aufklappbaren
  Unterkunftsliste, und als Pille im Reiseplan — überall mit 🚗-Präfix.
- Neue Etappen: Wert eintragen, bei eigener Schätzung `ca.` davorsetzen,
  damit erkennbar bleibt was gemessen und was geschätzt ist.

## Tanken

- **`data/04_tanken.csv` dupliziert keine Kosten** — jeder Tankvorgang steht
  bereits als `Ausgabe`/Kategorie `Tanken` in `data/02_laufend.csv`. Die
  Tanken-CSV ergänzt nur Liter, Preis/Liter (NAD) und Kilometerstand für
  dieselbe Zeile (verknüpft über Datum/Ort in der Anmerkung). Beim Eintragen
  neuer Tankbelege also **beide Dateien** pflegen: Betrag in `02_laufend.csv`,
  Details in `04_tanken.csv`.
- Verbrauch (L/100km) wird nur berechnet, wenn zwei **bestätigte Volltanks**
  (`volltanken = ja`) beide einen Kilometerstand haben — bei einer
  Teilbetankung dazwischen ist der echte Verbrauch unbekannt, dann bleibt der
  Bordcomputer-Schnitt die Quelle (seit 09.09.2026; vorher reichten zwei
  km-Stände, was bei „Tanken in Sesriem" ohne Voll-Bestätigung eine
  Scheinmessung erzeugt hätte). Sonst `null`, nie geschätzt. Beim Erfassen
  eines Tankvorgangs deshalb immer fragen: **voll?**
- Reichweite (km) = Tankgröße ÷ Verbrauch × 100, nur wenn beides in
  `data/fahrzeug.json` bzw. aus echten Fill-ups bekannt ist. Solange das
  Fahrzeugmodell `"TBD"` ist, zeigt die Seite "Tankgröße fehlt noch".
- `data/tankstellen_hinweise.csv` ist recherchiertes Allgemeinwissen zur
  Route (Stand 06.09.2026, siehe Quellen im Chat-Verlauf), keine Live-Daten -
  bei Bedarf mit tatsächlicher Erfahrung vor Ort aktualisieren.
- **Tanken ist ein eigener Tab** (nicht mehr unter „Mehr", Nutzerwunsch
  06.09.2026), mit der Tankplanung-Karte ganz oben.
- **`data/tankplanung.json` ist eine manuell gepflegte Momentaufnahme**,
  kein automatischer Tracker — es gibt keine Odometer-/GPS-Anbindung.
  Enthält: letzter bestätigter Volltank (Ort+Datum), aktueller Standort,
  geschätzte gefahrene km seit Volltank (aus Straßenentfernungen
  recherchiert, nie geraten ohne Quelle), nächster Pflicht-Tankstopp,
  Freitext-Empfehlung. `build_site_data.py` rechnet daraus
  `geschaetzte_rest_liter`/`geschaetzte_restreichweite_km` (Tankgröße −
  gefahrene km/100×Verbrauch). **Nach jedem Ortswechsel oder echten
  Tankvorgang aktualisieren**, sonst zeigt die Seite eine veraltete
  Position. Sobald ein Fill-up einen echten Kilometerstand hat, diese
  Datei mit dem neuen Nullpunkt (Ort, Datum, 0 km seit Volltank)
  überschreiben.

## Website (GitHub Pages, `docs/`)

- Mobile-first Single-Page-App, reines HTML/CSS/JS, **keine externen Libraries/CDNs**
  (funktioniert auch bei schlechtem Netz in Namibia; JSON wird zusätzlich in
  `localStorage` gecacht, damit die Seite auch offline zuletzt geladene Daten zeigt).
- **Offline-fähig per Service Worker (`docs/sw.js`, seit 08.09.2026).** Grund:
  Ohne Worker lädt die Seite bei komplett fehlendem Netz oft gar nicht erst -
  GitHub Pages cached Assets nur 10 Min. im Browser-HTTP-Cache, danach
  scheitert ein Ladeversuch ohne Empfang ganz. Der Worker hält HTML/CSS/JS
  dauerhaft im Cache Storage (stale-while-revalidate: sofort aus dem Cache
  antworten, im Hintergrund auffrischen) und `site-data.json` network-first
  mit Cache-Fallback (immer die frischeste Version, wenn online; zuletzt
  bekannte, wenn nicht). Damit öffnet die Seite auch im Flugmodus/ohne
  Empfang normal, mit dem letzten Stand.
  - `scripts/build_site_data.py::stamp_asset_versions()` pflegt `CACHE_VERSION`
    und die versionierten Dateinamen in `sw.js` automatisch mit (gleicher
    Hash-Mechanismus wie die `?v=`-Stempel in `index.html`) - **nie von Hand
    editieren**, außer neue Dateien zur `PRECACHE_URLS`-Liste hinzuzufügen.
  - Registrierung in `app.js` (`navigator.serviceWorker.register("sw.js")`),
    nur wenn der Browser Service Worker unterstützt - kein Blocker auf
    älteren/eingeschränkten Browsern.
  - **Getestet 08.09.2026:** Playwright mit echtem Server-Stopp (nicht
    `context.setOffline()` - das blockiert in Chromium/CDP die Anfrage schon
    vor der Service-Worker-Interception und liefert immer `ERR_FAILED`,
    unabhängig vom Worker; ein wirklich abgeschalteter Server ist der
    realistischere Test). Ergebnis: App-Shell und letzte `site-data.json`
    wurden korrekt aus dem Cache Storage bedient, Zahlen stimmten mit dem
    letzten Online-Stand überein.
- **5 gleichwertige Tabs unten** (Stand 06.09.2026, `id`/`data-view`/Hash
  in Klammern) — **Home, Kosten und Tanken sind bewusst eigene Kategorien,
  keine Unterpunkte voneinander** (Nutzer hat das ausdrücklich korrigiert,
  nachdem Home zuerst nur eine Umbenennung des Kosten-Tabs war):
  1. **Home** (`home`, 🏠) — der Startbildschirm, genau drei Blöcke, siehe unten
  2. **Kosten** (`kosten`, 💶) — Sub-Nav mit **zwei** Reitern „Übersicht"
     (Gesamt-Kacheln, Reisekasse, Saldo + Hinweis zur Saldo-Basis) und
     „Ausgaben". **Die Ausgabenliste trennt nach Gerätedatum:** oben alles
     bis heute, neueste zuerst, **gruppiert nach Tag** mit Tageskopf
     („Di, 08.09. · 4 Posten · 177,86 €") und einer Summenzeile über der
     Liste; darunter ein eingeklappter Block „Kommende Buchungen (n · Summe)"
     mit den Blatt-1-Zeilen, deren Check-in-Datum in der Zukunft liegt.
     Grund (Bug 07.09.2026): Blatt-1-Zeilen tragen das Check-in-, nicht das
     Zahldatum — ohne Trennung standen 11 vorausbezahlte Unterkünfte über den
     echten Einträgen von heute. **Eine Kartenfunktion für alle Listen**
     (`ausgabeCard()` in `app.js`, auch auf Home): links Kategorie-Farbpunkt
     (gleiche Farbe wie im Donut) + Titel, darunter Zahler als farbige
     Personen-Pille (Patrick blau, Nora violett — eigene Token `--person-*`,
     sonst nirgends verwendet) und Zahlmittel als Text; rechts Betrag,
     darunter der NAD-Originalbetrag. Nur „offen" bleibt eine Warnpille.
     - **„+"-Button & Bottom-Sheet (seit 08.09.2026, ersetzt den früheren
       Reiter „Erfassen"):** kleiner runder „+" im Abschnittskopf der
       Ausgabenliste und neben „Letzte Ausgaben" auf Home öffnet ein
       Bottom-Sheet (`#sheet-erfassen`) zum Erfassen ohne Netz: Betrag groß
       mit NAD/EUR-Segment, Ort/Beschreibung, **„Wer hat gezahlt?"
       (Patrick | Nora) als eigener Schritt**, „Womit?" (N26 | Debit | Bar |
       Kredit — wird nach Zahler vorbelegt: Nora→N26, Patrick→Bar, bleibt
       änderbar), Kategorie als Chip-Raster, Datum/Anmerkung eingeklappt.
       `Bargeld` erzwingt Zahler `Patrick` und sperrt das Segment
       (Grundregel 9). `parseBetrag()` versteht „1.250,00" und „980.01"
       (Review-Bug 08.09.: vorher wurde 1.250,00 zu 1,25).
     - **CUD — Bearbeiten und Löschen bestehender Einträge (seit 08.09.2026):**
       Tipp auf eine Ausgabenkarte (Liste oder Home) öffnet ein Aktions-Sheet
       (`#sheet-aktion`: Bearbeiten | Löschen | Abbrechen). Dafür trägt jede
       Zeile in `site-data.json` eine stabile `id` (`b1-<nr>` / `b2-<nr>`,
       aus `build_site_data.py`). Bearbeiten öffnet dasselbe Formular
       vorbelegt (Titel „Ausgabe bearbeiten"); Speichern erzeugt eine lokale
       Änderung `{op: "update", id, ref, original, entry}` — nur wirklich
       geänderte Felder zählen (`diffText()`), ohne Diff wird nichts
       gespeichert. Löschen (mit `confirm()`) erzeugt `{op: "delete", id,
       ref}`. Neue Einträge sind `{op: "create", entry}`; ein altes Schema
       ohne `op` wird beim Laden als `create` interpretiert. Alle lokalen
       Änderungen liegen unter `localStorage["namibia2026:pending-entries"]`.
       **Overlay:** `ausgabenAktuell(data)` legt die lokalen Änderungen über
       `data.ausgaben` — gelöschte Zeilen verschwinden aus der Liste,
       geänderte zeigen die neuen Werte mit Pille „geändert · wartet", neue
       erscheinen an ihrem Datum mit „neu · wartet" (Betrag in der erfassten
       Währung; EUR bleibt bei NAD-Neueinträgen unbekannt und wird in Summen
       als „+ n in NAD" ausgewiesen, nie geschätzt). **Die Kacheln im
       Kosten-Tab und Home-Donut zeigen weiterhin den Repo-Stand** — nur die
       Listen (Ausgabenliste, Letzte Ausgaben) das Overlay; die Summenzeile
       nennt „n lokal". Lokale Einträge lassen sich ebenfalls antippen und
       bearbeiten/verwerfen (`pendingIndex`).
       **Übergabe:** Karte „Noch nicht übergeben (n)" oben in der Liste mit
       „An Claude übergeben" — kopiert Klartext mit Präfixen `NEU:` /
       `ÄNDERN [id · Titel · Datum · Betrag]: Feld alt → neu; …` /
       `LÖSCHEN [id · …]` (`formatPending()`), plus „Leeren" (mit
       `confirm()`) und × je Zeile zum Verwerfen. Auf Home ein Link „n lokale
       Änderungen warten auf Übergabe →". **Wenn der Nutzer diesen Text im
       Chat einfügt:** `ÄNDERN`/`LÖSCHEN` beziehen sich über die id auf
       `01_bezahlt.csv` (`b1-`) bzw. `02_laufend.csv` (`b2-`) — Zeile per `nr`
       finden, Felder ändern bzw. Zeile entfernen (bei Blatt-1-Unterkünften
       nicht löschen, sondern nach Regel 6 auf 0 setzen, falls es um eine
       Vor-Ort-Zahlung geht — nachfragen, wenn unklar), danach normal bauen
       und pushen; `NEU` wie jeden Beleg verbuchen. **Kein** automatischer
       Schreibzugriff aufs Repo (Entscheidung 08.09.2026: ein GitHub-Token im
       Browser eines Handys, das verloren gehen oder geteilt werden kann,
       wäre bei einem öffentlichen Repo ein Sicherheitsrisiko und würde alle
       Prüfungen beim Verbuchen umgehen).
       CSS-Fallstrick: `[hidden] { display: none !important }` steht global
       in `style.css`, weil Author-Regeln mit `display:` (z. B. `.link-button
       { display: block }`, `.badge { display: inline-block }`) das UA-Default
       fürs `hidden`-Attribut sonst schlagen — Review 08.09.2026 fand einen
       unsichtbaren, aber tappbaren Home-Link.
  3. **Tanken** (`tanken`, ⛽) — Tankplanung-Karte, Verbrauch/Reichweite,
     Tankvorgänge, Tankstellen-Planung
  4. **Reiseplan** (`plan`, 🗺️) — Zeitleiste, heutiger Tag live aus dem
     Gerätedatum des Betrachters hervorgehoben; jede Karte zeigt Betrag und
     (wenn bezahlt) Zahler + Zahlmittel — `build_site_data.py` liefert dafür
     `plan[].betrag/zahler/zahlmittel` und führt aufgeteilte Posten (Flug je
     zur Hälfte) zu einem Eintrag mit Summe und „Patrick + Nora" zusammen
     (`zahlerPill()` rendert das neutral als `zahler-beide`). Fahrzeit-Pille
     heißt „Anfahrt 1h15" und ist neutral (kein Akzent mehr)
  5. **Mehr** (`mehr`, ⋯) — Verrechnung als Gegenüberstellung Patrick | Nora
     (Selbst gezahlt / Überweisung / Effektiv getragen / Fairer Anteil, darunter
     der Saldo-Satz), offene Punkte mit Titel + aufklappbaren Details (Titel =
     erster Halbsatz vor „—", „." oder „:", sonst nach ~84 Zeichen gekürzt)
- **Kleinstes Zielgerät ist ein iPhone 15 (393 × 852 CSS-Pixel)** — vom
  Nutzer am 06.09.2026 festgelegt. Nicht mehr auf 320px optimieren
  (deshalb heißt Tab 4 wieder ausgeschrieben „Reiseplan"). Beim Testen
  mit Playwright diese Viewport-Größe verwenden.
- **Die Kopfzeile erscheint nur auf Home** und ist bewusst kompakt
  (`.app-header.hidden` wird in `showView()` gesetzt, sobald der Tab
  nicht `home` ist). Ihre Unterzeile trägt seit 08.09.2026 „Tag X von Y ·
  02.09. – 21.09.2026" (aus `renderHeute()`); der frühere separate
  Tag-Badge auf Home ist entfallen (Redundanz laut UX-Audit). Auf den anderen Tabs übernimmt die Bottom-Nav die
  Orientierung. **Wichtig dabei:** ohne sichtbaren Header muss der Inhalt
  selbst um Notch/Dynamic Island herum — dafür sorgt
  `.app-header.hidden ~ main { padding-top: calc(16px + env(safe-area-inset-top)) }`.
  Diese Regel nicht entfernen, sonst startet der Inhalt auf dem iPhone
  unter der Statusleiste (im Desktop-Browser unsichtbarer Fehler).
- **Home enthält genau diese drei Blöcke, in dieser Reihenfolge**
  (Nutzervorgabe, nicht selbst erfunden — bei Layoutwünschen daran
  orientieren):
  1. Reise-Status, klein oben: aktuelle Unterkunft, nächstes Ziel,
     aufklappbare Liste „Alle Unterkünfte" mit Maps-Links — berechnet aus
     `data.plan`, gefiltert auf `kategorie === "Unterkunft"`, verglichen
     gegen das *Gerätedatum des Betrachters*, nicht gegen `generated_at`.
     „Aktuell" und „Nächstes Ziel" sind selbst Google-Maps-Links
     (`info_link`, Nutzerwunsch 08.09.2026, `.reise-link` mit ↗)
  2. Letzte 5 Ausgaben — `bisherigeAusgaben(data).slice(-5).reverse()` in
     `app.js`: `data.ausgaben` ist nach `(datum, zeit)` aufsteigend sortiert,
     wird aber erst gegen das Gerätedatum auf „bis heute" gefiltert, sonst
     stünden vorausbezahlte Unterkünfte mit künftigem Check-in oben. Gleiche
     Karte wie in der Ausgabenliste (`ausgabeCard(a, true)`), im Abschnitts-
     kopf der „+"-Button fürs Bottom-Sheet, darunter ggf. der Link „n Einträge
     warten auf Übergabe →" und der Button „Alle Ausgaben anzeigen", der per
     `showView("kosten") + showSubView("ausgaben")` in den Kosten-Tab springt
  3. Gesamtkosten als Tortendiagramm (Donut + Legende)
  Stat-Kacheln, Reisekasse und Saldo gehören **nicht** auf Home, sondern in
  den Kosten-Tab.
- Sub-Nav-Umschaltung (`showSubView()` in `app.js`) ist reines Anzeigen/
  Verstecken, nicht in der URL kodiert (kein Deep-Link auf die Ausgabenliste).
  Die DOM-IDs der einzelnen Widgets (`#header-subline`, `#t-gesamt`,
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
- **Cache-Busting:** GitHub Pages liefert Assets mit `max-age=600`. Damit
  nach einem Push nicht 10 Minuten lang das alte `app.js` gegen die neue
  `site-data.json` läuft (so sind am 07.09.2026 zweimal „veraltete" Ansichten
  entstanden), stempelt `build_site_data.py` einen Inhalts-Hash als `?v=`
  an `app.js` und `style.css` in `index.html`. Der Stempel ändert sich nur,
  wenn sich die Datei ändert. `site-data.json` selbst wird mit
  `cache: "no-store"` geladen. `index.html` bleibt 10 Min gecacht — dagegen
  hilft nur Neuladen.
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
- **Dark-Mode-Design „Sternenhimmel über der Namib"** (seit 08.09.2026,
  ersetzt „Namibia bei Nacht" — das warme Wüstenschwarz mit Terrakotta und
  Dünen-Silhouette gefiel dem Nutzer nicht). Story: NamibRand ist ein
  Dark-Sky-Reserve. Tiefes, kühles Nachtblau als Grund (`--bg: #0b1220`),
  Karten eine Stufe heller/bläulicher (`--bg-elevated: #141d2f`), warmes
  Sand-/Amber-Gelb als Akzent (`--accent: #e8b45a`, Kontrast auf `--bg`
  9,9:1), Text leicht warm getönt (`#ece8df`, 15,3:1), **kein Hintergrund-
  bild mehr**. Alle Paare per dataviz-Validator/WCAG geprüft (Dark-Block in
  `style.css` dokumentiert die Kontraste). Zusatzregeln stehen im Block
  „Dark-Theme Sternenhimmel (Zusatzregeln)" am Dateiende (`color-scheme:
  dark`, Badge-Textfarbe, Innen-Lichtsaum auf Karten, Offene Punkte als
  Karte mit Warn-Kante); die Personenfarben für Dark (`--person-*`) im
  Block direkt danach. `<meta name="theme-color">` in `index.html`: hell
  `#faf6f0`, dunkel `#0b1220`. Beim Weiterbauen: neue Farben gegen `--bg`
  UND `--bg-elevated` prüfen, nicht eyeballen.
- **Typografie-Skala:** fünf Token in `:root` (`--fs-xs` 12px, `-sm` 13px,
  `-md` 15px, `-lg` 17px, `-xl` 24px) — keine weiteren Zwischenwerte
  einführen (UX-Audit 08.09.2026 fand 21 verschiedene Schriftgrößen).
  Interaktive Elemente haben `min-height` ≥ 40–48px (Touch-Ziele).
- **UX-Audit 08.09.2026** (Subagent, Light Mode, iPhone 15) lieferte 15
  Befunde; umgesetzt: Touch-Ziele, Tagesgruppierung + Summen in der
  Ausgabenliste, Karten-Layout mit Zahler/Zahlmittel-Hierarchie und
  Personenfarben, Tankplanung-Texte ohne Dateiverweise + „Hintergrund"
  einklappbar, Toast/Inline-Fehler im Formular, Fehlerbanner bei Ladefehler,
  Verrechnung als Personen-Gegenüberstellung, Offene Punkte gekürzt,
  Tanken-Kacheln 2×2 mit Quelle als Fußnote, Tag-Badge in die Kopfzeile,
  „Anfahrt"-Beschriftung, Nächstes Ziel zweizeilig, „Datenstand" ohne
  Sekunden. Bewusst nicht umgesetzt: Floating-Action-Button (Nutzer wollte
  explizit einen kleinen „+" in der Liste), Sticky-Filterzeile.

## Konventionen

- Beträge in CSV: Punkt als Dezimaltrennzeichen, keine Tausenderpunkte, ohne Währungszeichen
- Datum: `YYYY-MM-DD`
- Sprache aller Inhalte: Deutsch
- Antworten an den Nutzer: Deutsch, Empfehlung zuerst, keine Annahmen ohne Kennzeichnung
- Bei jeder Nutzernachricht: **aktuelles Datum und Uhrzeit per `date` holen** (auch Africa/Windhoek)
