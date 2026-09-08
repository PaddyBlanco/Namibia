# Handover — Namibia 2026

**Stand:** 08.09.2026, 16:50 Uhr (Windhoek = Wien) · Reisetag 7 von 20
**Branch:** `claude/namibia-2026-bkm6h4` · alles gepusht

Dieses Dokument beschreibt, **wo das Projekt steht und wie es weitergeht**.
Die technischen Regeln (Datenmodell, Konventionen, Fallstricke) stehen in
[`CLAUDE.md`](../CLAUDE.md) — dieses Handover wiederholt sie nicht.

---

## 1. Was fertig ist

### Kostenerfassung
Vollständiges Datenmodell in `data/*.csv`, aus dem zwei Ansichten erzeugt werden:
`docs/kosten.md` (lesbar auf GitHub) und `docs/assets/data/site-data.json` (für die Website).

**Aktueller Stand:**

| | |
|---|---|
| Gesamtausgaben | 6.220,56 € |
| davon bezahlt | 5.792,76 € |
| noch offen | 427,80 € |
| Kassenbestand (Bargeld) | 175,88 € |
| Saldo | Nora schuldet Patrick 3.091,43 € |
| erfasste Ausgaben | 42 Einträge |

Der Saldo ist hoch, weil Patrick vor der Reise 2.000 € an Nora überwiesen hat,
die sie größtenteils noch nicht für gemeinsame Kosten ausgegeben hat. Sobald
sie damit zahlt, sinkt der Saldo automatisch.

**Saldo-Definition (geändert 07.09.2026):** 50/50 auf Basis dessen, was bisher
tatsächlich von Patrick oder Nora bezahlt wurde — nicht mehr auf die Gesamtsumme
inkl. der 427,80 € offen (das hatte stillschweigend unterstellt, Nora zahle alle
offenen Posten, und den Saldo um 213,90 € zu niedrig gezeigt). Rechenlogik
liegt zentral in `scripts/kosten_core.py`, siehe CLAUDE.md Grundregel 8.

### Website (GitHub Pages)
Mobile-first, ohne externe Bibliotheken, **offlinefähig per Service Worker**
(öffnet auch ohne Empfang mit dem letzten Stand). **5 Tabs:**

1. **Home** — Kopfzeile mit „Tag X von 20", Reise-Status (aktuelle Unterkunft,
   nächstes Ziel mit Anfahrt, alle Unterkünfte mit Google-Maps-Links), letzte
   5 Ausgaben mit „+"-Button, Gesamtkosten-Tortendiagramm
2. **Kosten** — „Übersicht" (Kacheln, Reisekasse, Saldo) und „Ausgaben"
   (nach Tagen gruppiert mit Tagessummen, filterbar; „+" öffnet das
   Erfassungs-Sheet; oben ggf. „Noch nicht übergeben" mit Übergabe an Claude
   per Zwischenablage; unten eingeklappt „Kommende Buchungen")
3. **Tanken** — Tankplanung („wo als nächstes tanken"), Verbrauch/Reichweite,
   Tankvorgänge, recherchierte Tankstellen entlang der Route
4. **Reiseplan** — Zeitleiste mit Betrag und Zahler je Station, heutiger Tag
   hervorgehoben
5. **Mehr** — Verrechnung Patrick | Nora, offene Punkte

**Offline erfassen:** „+" antippen → Betrag, Ort, wer/womit, Kategorie →
Speichern. Bleibt auf dem Handy; bei Netz in der Ausgabenliste „An Claude
übergeben" → Text im Chat einfügen → Claude verbucht → „Leeren".

Dark Mode „Sternenhimmel über der Namib" (Nachtblau, Sand-Akzent, kein Hintergrundbild).
Getestet auf iPhone-15-Größe (393 × 852) in hell und dunkel.

### Recherchiert und dokumentiert
- **Kartenkonditionen** (`docs/karten-gebuehren.md`): Kartenzahlungen über Noras
  N26 (0 % Fremdwährungsgebühr), Bargeld über Patricks Oberbank Debit.
  Nie mit der card complete Mastercard abheben (3 %, min. 4 €).
- **Rückforderung card complete:** OGH-Urteil 01/2026 — nach der Reise
  unzulässige Fremdwährungsentgelte zurückfordern.
- **Tankstellen entlang der Route** (`data/tankstellen_hinweise.csv`):
  wichtigster Punkt — Solitaire ist die einzige Tankstelle zwischen dem
  Sesriem-Gebiet und der Küste.

---

## 2. Was noch offen ist

### Daten, die nur Patrick/Nora liefern können
Diese drei Punkte stehen auch in `docs/offene-punkte.md` und erscheinen auf der
Website unter „Mehr":

1. **Hoada-Anzahlung** — Höhe unbekannt, aktuell 45 € komplett als offen geführt
2. **N26-Kurse noch vorläufig** — fünf Umsätze standen bei der Erfassung auf
   „wird bearbeitet"; dazu die Desert-Horse-Anzahlung (460 NAD am 23.04.,
   Nora/N26) mit vorläufig 24,96 € — echten N26-Betrag aus der App nachtragen
3. **Tanken-Details** — Mietwagen-Modell, Herstellerverbrauch, sowie Liter/Preis/
   Kilometerstand der ersten drei Tankvorgänge (Helmeringhausen ist vollständig)

### Nicht verifiziert
- **Die Live-Website konnte ich nicht selbst prüfen.** GitHub Pages ist laut
  API aktiv (`has_pages: true`), aber die Umgebung dieser Session blockiert
  `github.io` per Netzwerk-Policy. **Bitte einmal selbst öffnen:**
  https://paddyblanco.github.io/Namibia/
  Falls die Seite nicht lädt: Settings → Pages → Branch
  `claude/namibia-2026-bkm6h4`, Ordner `/docs` prüfen.

### Bewusste Entscheidungen (nicht vergessen)
- **Repo ist öffentlich.** Alle Beträge, Namen und der Saldo sind über die
  normale GitHub-Dateiansicht für jeden einsehbar — vom Nutzer bestätigt.
- **Nie Buchungslinks mit Tokens** ins Repo (die alten Google-Sheet-Links
  enthielten `auth_key=`/`sid=`). Unterkunfts-Links sind ausschließlich
  Google-Maps-Suchlinks.
- Das **Google Sheet wird nicht mehr gepflegt** — der Drive-Connector kann
  keine Zellen in bestehenden Sheets ändern, deshalb Markdown/Website im Repo.

---

## 3. Wie es weitergeht

### Neuer Beleg unterwegs
Screenshot schicken → Claude trägt ein und pusht. Ablauf intern:

```bash
# 1. Zeile in die passende CSV (Zahler nicht vergessen)
# 2. Ansichten neu bauen
python3 scripts/build_md.py
python3 scripts/build_site_data.py
# 3. committen + pushen auf claude/namibia-2026-bkm6h4
```

### Nach jedem Tankvorgang
Zusätzlich `data/04_tanken.csv` (Liter, Preis/Liter, **Kilometerstand**) und
`data/tankplanung.json` (neuer Nullpunkt) aktualisieren. Sobald zwei Fill-ups
einen echten Kilometerstand haben, ersetzt der gemessene Verbrauch automatisch
den Bordcomputer-Schätzwert.

### Nach jedem Ortswechsel
`data/tankplanung.json` aktualisieren (Standort + gefahrene km seit Volltank),
sonst zeigt die Tankplanung eine veraltete Position.

### Nach der Reise
- Rückforderung bei card complete stellen (siehe `docs/karten-gebuehren.md`)
- Endabrechnung: Saldo zwischen Patrick und Nora ausgleichen
- Branch nach `main` mergen, damit die Website auch vom Hauptbranch läuft

---

## 4. Nächster konkreter Schritt

**Stand Dienstag 08.09., Little Sossus Campsite (bis 10.09.):**
- Park-Permit für Sesriem/Sossusvlei ist bezahlt (67,08 €, gilt 24 h ab
  Einfahrt) — Sonnenaufgang Sossusvlei/Deadvlei am 09.09. ggf. noch im
  selben Permit, sonst neues Tagespermit (2 × 280 NAD + 50 NAD Fahrzeug)
- **Little Sossus 84 € vor Ort fällig** (steht als „offen")
- Weiterfahrt 10.09. nach Moonvalley (Swakopmund), **Anfahrt 5–7 h**:
  **in Solitaire volltanken** (~80 km ab Sesriem) — danach 340 km ohne
  Tankstelle bis Walvis Bay
- Unterwegs ohne Netz: Ausgaben über „+" in der App erfassen, bei Netz
  „An Claude übergeben"
