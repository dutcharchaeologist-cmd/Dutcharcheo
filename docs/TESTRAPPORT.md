# Testrapport — History Content Engine v5.3

Datum: 12 oktober 2026 · Getest in Chromium (Playwright 1.56), mobiel formaat 412 × 915 (Samsung-achtig) en desktop 1280 × 900.
Testscript: `tests/e2e.mjs` — **35 van 35 controles geslaagd**, geen JavaScript-fouten.

## Belangrijk: het echte RepostHQ-bestand ontbrak

`TDA_RepostHQ_alle_posts_2026-10-07(1).xlsx` was in deze sessie niet beschikbaar. De import is daarom getest met
vier synthetische exports van elk 1.250 posts (`tests/fixtures/`), die de varianten nabootsen die de v5.2-fout
konden veroorzaken:

| Bestand | Wat het nabootst | Resultaat |
|---|---|---|
| `A_reposthq_style.xlsx` | Samenvattingsblad vóór het postsblad; kolommen Message / Views / Earnings (USD) | 1.250 posts, juiste blad automatisch gekozen |
| `B_meta_style_header_row3.xlsx` | Kopregel op rij 3, zowel Title (leeg) als Description, zowel Reach als Views, kolom "Reactions, Comments and Shares", Excel-datums | Description en Views correct gekozen; datums en shares ingelezen |
| `C_nederlands_puntkomma.csv` | Puntkomma, Nederlandse koppen (Berichttekst, Weergaven, Keer gedeeld, Inkomsten), `1.234.567`, `€ 12,34`, `12,3K`, teksten met komma's en regeleinden | 1.250 posts, alle getallen correct |
| `D_onbekende_kolommen.csv` | Kolomnamen die niets zeggen (Kol1…Kol4) | Koppelscherm verschijnt; na kiezen 300 posts |

**Volgende stap:** open de app, ga naar **Analyse** en kies het echte bestand. Lukt de automatische herkenning
niet, dan verschijnt het koppelscherm met per kolom een voorbeeldwaarde. De statusregel meldt precies welke
kolommen gebruikt zijn; stuur die regel (of de kolomnamen) door als er iets niet klopt.

## Wat getest is en werkt

**Import en dashboard**
- XLSX lezen zonder internet (eigen lezer via de ingebouwde `DecompressionStream` van Chrome); `.xls` valt terug op SheetJS via CDN.
- CSV: scheidingsteken (`,` `;` tab `|`) wordt bepaald door de structuur te parsen, niet door tekens te tellen. Dit was een echte bug: in de eerste testronde koos de app een komma omdat de postteksten komma's bevatten.
- Getalnotaties: `1.234.567`, `€ 12,34`, `12,3K`, `$1,234.56`, `1.5M`, `3,4 mln`, `—`.
- Dezelfde tekst op verschillende dagen telt als aparte posts (belangrijk bij reposts). Alleen echte dubbels (zelfde link, of zelfde tekst én tijdstip) worden overgeslagen. Ook dit was een bug in de eerste testronde.
- Import blijft bewaard na herladen (IndexedDB in de browser).
- Dashboard: 8 kerncijfers, top 20 op views / inkomsten / shares / RPM / engagement, onderwerpen, periodes, spreidingsdiagram views × inkomsten, RPM per onderwerp, formats, hookkenmerken, dag/tijdvak, advies. Groepen met minder dan 15 posts krijgen "weinig data" en tellen niet mee in het advies.

**Dagelijkse batch**
- 12 posts + `RESERVES`-blok met 5 posts → 17 items (in v5.2 stopte het inlezen bij `RESERVES`, de reserves gingen verloren).
- Rangschikking met redenen per post; "Kies beste 12 + 5 reserves" sorteert, markeert en herberekent het schema (08:00, 09:00 …). "Oorspronkelijke volgorde" zet alles terug.
- Gelijkenis met eerdere posts uit de import (bijv. een tweede Afsluitdijk-post) wordt gemeld.
- 12 previews gerenderd als PNG, 1080 × 1920 in het vaste TDA-sjabloon; reserves worden pas gerenderd als je ze kiest.
- ZIP met alle beelden (gecontroleerd met Python `zipfile`: geldig, 12 PNG's).
- Wikimedia Commons zoeken → resultaat kiezen → beeldlink, bronpagina en credit met licentie worden ingevuld.
- Metricool-CSV: zonder upload alleen de kopregel; na upload 12 regels, UTF-8 met BOM, captions byte-voor-byte ongewijzigd.
- Bronnenlijst-CSV, reservekopie (JSON) maken en terugzetten, editor "Opslaan als PNG".

**Live gecontroleerd tegen echte diensten**
- De Commons-zoekopdracht van de app is los tegen de echte Wikimedia-API getest (geeft echte bestanden met licentie terug).
- Gevonden: Wikimedia levert miniaturen nu via `thumb.wikimedia.org` en weigert afwijkende breedtes (1800 px gaf HTTP 400). De app vraagt nu 1920 px en herkent `thumb.wikimedia.org`.

## Wat externe diensten nodig heeft

| Functie | Vereist | Getest |
|---|---|---|
| Cloudinary-upload en Metricool-CSV met beeldlinks | Cloudinary-account met *unsigned upload preset* | Met nagebootste Cloudinary-API (geen echte upload) |
| Wikimedia Commons zoeken / Wikimedia-beelden laden | Internet | Zoeken live los getest; in de app-test nagebootst |
| `.xls` (oud Excel-formaat) | Internet (SheetJS van jsDelivr) | Niet getest; `.xlsx` en `.csv` werken offline |
| AI-beelden en Engelse tekst genereren | Eigen server met `/api/image` en `/api/text` | Niet getest; zie `AI-BEELDGENERATIE.md` |
| Zoeklinks Rijksmuseum, Nationaal Archief, Beeldbank RCE, Delpher, Google | Internet | Links openen alleen de zoekpagina |

## Niet getest

- Op een fysieke Samsung-telefoon (wel in Chromium met mobiel formaat en touch).
- Een echte Cloudinary-upload en een echte import in Metricool.
- Het echte RepostHQ-bestand (zie boven).
