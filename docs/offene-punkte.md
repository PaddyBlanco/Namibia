# Offene Punkte

Stand: 08.09.2026, 16:40 Uhr (Windhoek/Wien). Nichts davon wurde geraten — alles offen markiert.

## Blockierend für korrekte Zahlen

| # | Punkt | Warum es zählt |
|---|---|---|
| 1 | **Hoada und Onguma (2 Nächte) — Belege fehlen** — laut Patrick (11.09.) von Nora komplett vorab bezahlt, aktuell mit den Planwerten 45 € / 2 × 58 € als bezahlt geführt, Karte unbekannt (TBD). Kartenbelege (NAD, EUR, Karte) aus Noras Banking-App nachtragen. | Betrag und Zahlmittel vorläufig |
| 2 | **N26-Kurse noch vorläufig** — fünf Umsätze standen bei der Erfassung auf „Wird bearbeitet" (Agra Keetmanshoop, Klein Aus Vista, Ghost Town Tours, Desert Deli, Portugues Fisherman), Kurs kann sich laut N26 noch ändern. | Kleine Rundungsabweichungen möglich, sobald final gebucht |
| 3 | **Tanken-Details:** Mietwagen-Modell, Herstellerverbrauch und bisherige Tankvorgänge (Liter, Preis/Liter, Kilometerstand) fehlen noch — Tankgröße ist bereits bekannt (160 L, 2×80 L). Betrifft nicht die Kostensumme (die stimmt bereits), nur die Reichweiten-/Verbrauchsanzeige auf der Seite. | Reichweite lässt sich erst berechnen, wenn zusätzlich der Verbrauch bekannt ist (Herstellerangabe oder mind. 2 Fill-ups mit km-Stand) |

## Nach der Reise

- **card complete Rückforderung:** OGH-Urteil 01/2026, Rückzahlung unzulässiger
  Fremdwährungsentgelte per Online-Formular bei card complete beantragen.
  Betrifft alle Fremdwährungsumsätze der Mastercard, auch aus Vorjahren.

## Erledigt

- Bargeld-Logik festgelegt: Abhebung = Umbuchung, nicht Ausgabe (nur Entgelt zählt).
- Kartenempfehlung recherchiert (`docs/karten-gebuehren.md`).
- **Flug (1.895,26 €):** gleichmäßig zwischen Patrick und Nora aufgeteilt
  (je 947,63 €), beide Anteile bereits bezahlt. Zahlmittel je Anteil noch
  unbekannt (`TBD`). Vorherige Annahme „komplett Nora" war falsch.
- Unterkünfte: Patrick hat keine davon direkt bezahlt — vorab bezahlte Camps
  (Okaukuejo, Halali, Waterberg, Omatozu, Hoada-Anzahlung) liefen über Nora.
  *(Korrektur 07.09.: das vermeintliche „Desert-Horse-Deposit" von 24 € war
  der Kolmanskop-Eintritt, siehe unten.)*
- Quiver Tree Camping: 720 NAD bar von Patrick bezahlt, in Blatt 02 verbucht
  (Blatt-1-Zeile auf 0 € gesetzt, um Doppelzählung zu vermeiden).
- 9 neue N26-Umsätze von Nora aus Screenshots erfasst (04.–06.09.).
- Workflow von Google Sheet auf Markdown im Repo umgestellt (siehe CLAUDE.md) —
  schneller während der Reise, `docs/kosten.md` ist jetzt die primäre Ansicht.
- **Mietwagen:** 2.726,15 € bestätigt (weder 2.805,00 € noch 2.605,03 € aus dem
  alten Sheet waren korrekt).
- **Superspar Maerua Mall (169,22 €):** Karte bestätigt — Patricks Oberbank Debit.
- **Flughafen-Umsätze Wien/München (27,55 € gesamt):** Karte auf Wunsch nicht
  weiter geklärt, bleibt als `Zahlmittel = TBD` stehen.
- **Agrimark Rehoboth (73,42 €):** Kategorie auf „Tanken" korrigiert (Diesel,
  nicht Ausrüstung).
- **2.000-€-Überweisung Patrick → Nora:** vor Reisebeginn (vor 02.09.2026)
  überwiesen, exaktes Datum nicht bekannt.
- **Kalahari Anib Campsite (36 €):** vorab von Nora bezahlt (N26 Debit),
  wie die anderen im Voraus gebuchten Camps.
- **Vorab-Zahlungen Nora mit Bankbelegen abgeglichen (10.09.):** Kalahari
  Anib 36,67 €, Little Sossus 84,58 €, Okaukuejo 59,54 €, Halali 45,96 €,
  Waterberg 46,11 €, Granietkop 50,30 €, Omatozu 35,64 €, Desert-Horse-
  Anzahlung 25,15 € (statt vorläufig 24,96 €) — alle im April per Karte „K2"
  bezahlt = Noras normale Bank-Debitkarte, nicht N26 (Patrick, 10.09.;
  Zahlmittel `Nora Debit`).
  Granietkop und Little Sossus damit nicht mehr offen. Zuordnung der zwei
  gleichen NWR-Zahlungen (je 860 NAD) zu Halali/Waterberg ist eine Annahme,
  Summe identisch.
- **Wereldend Mountain Campsite (47,80 €):** bestätigt noch nicht fällig,
  bleibt planmäßig als „cash on arrival" offen.
- **Little Sossus (84 €), Moonvalley (25 €), Spitzkoppe (62 €):** bestätigt
  noch nicht fällig, alle drei liegen noch in der Zukunft (08./10./11.09.),
  bleiben planmäßig offen.
- **Hoada (45 €) und Onguma 2 Nächte (116 €):** laut Patrick (11.09.) von Nora
  komplett vorab bezahlt; Planwerte als bezahlt übernommen, Belege fehlen noch
  (siehe Blockierend Nr. 1).
- **Tankgröße:** 160 Liter, aufgeteilt in 2×80-Liter-Tanks (Haupt- + Zusatztank).
- **Klein-Aus Vista, 100,91 € vom 05.09. aufgeklärt** (Rechnung 6483110, erhalten
  beim Auschecken am 07.09.): Es war *nicht* nur die Unterkunft. Die Zahlung
  bestand aus 460 NAD Unterkunfts-Restzahlung (24,96 €) und 1.400 NAD für den
  **Sunset Drive für zwei Personen** (75,95 €) — letzterer war bis dahin
  überhaupt nicht erfasst. Beide Posten stehen jetzt getrennt in
  `02_laufend.csv`. Die ursprünglich vermutete „Differenz zur Planung" war also
  eine bisher unbekannte Aktivität, kein Fehler.
- **Getränke Klein-Aus Vista (102 NAD ≈ 5,53 €)** beim Auschecken am 07.09. von
  Nora per N26 bezahlt — war der Restsaldo derselben Rechnung.
- **„Desert Horse Campsite 24 €" (Blatt 1 Nr. 6) war der Kolmanskop-Eintritt**
  (Patrick, 07.09.) — und zwar dieselbe Zahlung wie „Ghost Town Tours CC"
  24,96 € vom 06.09. (Blatt 2 Nr. 12, jetzt Kategorie `Eintritt`). Die 24 €
  in Blatt 1 waren also keine eigene Zahlung und sind gestrichen; die
  Unterkunfts-Zeile bleibt mit 0 € als Buchungsreferenz (Restzahlung 460 NAD
  steht in Blatt 2 Nr. 11).
- **Desert-Horse-Anzahlung 460 NAD (23.04.):** von Nora vorab per N26 gezahlt
  (Patrick, 07.09.). In Blatt 1 Nr. 6 mit vorläufig 24,96 € erfasst (Kurs der
  Restzahlung) — echter N26-Betrag noch nachzutragen, siehe Punkt 2.
