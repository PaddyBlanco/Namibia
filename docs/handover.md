# Handover — Namibia 2026

**Stand:** 06.09.2026, 23:05 Uhr (Windhoek = Wien) · Reisetag 5 von 20
**Branch:** `claude/namibia-2026-bkm6h4` · 18 Commits · alles gepusht

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
| Gesamtausgaben | 6.039,70 € |
| davon bezahlt | 5.611,90 € |
| noch offen | 427,80 € |
| Kassenbestand (Bargeld) | 178,56 € |
| Saldo | Nora schuldet Patrick 3.179,18 € |
| erfasste Ausgaben | 36 Einträge |

Der Saldo ist hoch, weil Patrick vor der Reise 2.000 € an Nora überwiesen hat,
die sie größtenteils noch nicht für gemeinsame Kosten ausgegeben hat. Sobald
sie damit zahlt, sinkt der Saldo automatisch.

**Saldo-Definition (geändert 07.09.2026):** 50/50 auf Basis dessen, was bisher
tatsächlich von Patrick oder Nora bezahlt wurde — nicht mehr auf die Gesamtsumme
inkl. der 427,80 € offen (das hatte stillschweigend unterstellt, Nora zahle alle
offenen Posten, und den Saldo um 213,90 € zu niedrig gezeigt). Rechenlogik
liegt zentral in `scripts/kosten_core.py`, siehe CLAUDE.md Grundregel 8.

### Website (GitHub Pages)
Mobile-first, ohne externe Bibliotheken, offlinefähig. **5 Tabs:**

1. **Home** — Reise-Status (aktuelle Unterkunft, nächstes Ziel, alle Unterkünfte
   mit Google-Maps-Links), letzte 5 Ausgaben, Gesamtkosten-Tortendiagramm
2. **Kosten** — Untermenü: Kostenübersicht (Kacheln, Reisekasse, Saldo) und
   Ausgabenliste (filterbar nach Kategorie und Zahler; oben alles bis heute,
   neueste zuerst, darunter eingeklappt „Kommende Buchungen")
3. **Tanken** — Tankplanung („wo als nächstes tanken"), Verbrauch/Reichweite,
   Tankvorgänge, recherchierte Tankstellen entlang der Route
4. **Reiseplan** — Zeitleiste, heutiger Tag hervorgehoben
5. **Mehr** — Verrechnung, offene Punkte

Dark Mode im Namibia-Stil (Wüstenschwarz, Terrakotta-Akzent, Dünensilhouette).
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
Diese vier Punkte stehen auch in `docs/offene-punkte.md` und erscheinen auf der
Website unter „Mehr":

1. **Hoada-Anzahlung** — Höhe unbekannt, aktuell 45 € komplett als offen geführt
2. **Klein Aus Vista, 100,91 € am 05.09.** — war das nur die Desert-Horse-Restzahlung
   oder mehr? Plan sah nur 24 € vor (76,91 € Differenz)
3. **5 N26-Umsätze** standen beim Screenshot auf „wird bearbeitet" — Kurs kann
   sich noch leicht ändern
4. **Tanken-Details** — Mietwagen-Modell, Herstellerverbrauch, sowie Liter/Preis/
   Kilometerstand der drei bisherigen Tankvorgänge

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

**Morgen früh, Montag 07.09.:**
- Check-out Desert Horse Campsite Aus um **10:00 Uhr** (öffentliche Angabe von
  Klein-Aus Vista, nicht aus eurer Buchungsbestätigung)
- **In Aus volltanken** — danach kommt bis Solitaire (~348 km) keine sichere
  Tankstelle mehr
- Weiter zu Wêreldend Mountain Campsite, **47,80 € bar vor Ort** fällig
