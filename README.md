# History Content Engine

Mobiele contentproductie-app voor **The Dutch Archaeologist** en **History Teacher**.
Eén HTML-bestand, werkt op Android (Chrome) en desktop. Publiceert nooit automatisch.

**De app:** [`dist/history-content-engine-v5-3.html`](dist/history-content-engine-v5-3.html)
Download dit bestand en open het in Chrome. Meer is niet nodig.

## Indeling (v5.3)

| Tab | Wat je er doet |
|---|---|
| **Vandaag** | 1 batch inlezen → 2 beste 12 + 5 reserves kiezen → 3 beelden en previews → 4 controleren en exporteren |
| **Analyse** | RepostHQ-export importeren en het performance-dashboard bekijken |
| **Editor** | Eén losse post maken (foto, kop, IMAGE STORY), Engelse tekst via eigen server |
| **Stijl** | Opmaak per merk (TDA-sjabloon, History Teacher-sjabloon) |
| **Instellingen** | PNG/JPEG, Cloudinary, proxy, Metricool-CSV, eigen AI-server, reservekopie |

## Ontwikkelen

De bron staat in `src/`; het logo en de analysemodule worden bij het bouwen ingevoegd.

```bash
python3 build.py                 # → dist/history-content-engine-v5-3.html
python3 tests/make_fixtures.py   # testbestanden (synthetische RepostHQ-exports)
node tests/e2e.mjs               # end-to-end test in Chromium (mobiel formaat)
```

- `src/app.html` – opmaak, editor, batchverwerking, export
- `src/perf.js` – Performance Intelligence: import, dashboard, rangschikking
- `src/tda-logo.png` – TDA-logo (512 px)
- `docs/TESTRAPPORT.md` – wat getest is en wat externe diensten nodig heeft
- `docs/AI-BEELDGENERATIE.md` – onderzoek: goedkope en veilige AI-beelden
