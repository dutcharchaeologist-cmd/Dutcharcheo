# AI-beeldgeneratie: goedkoop en veilig integreren

Stand van zaken v5.3: de app genereert zelf geen beelden. Er zijn twee routes die al werken:

1. **Handmatig (nu, gratis binnen je bestaande abonnement):** bij een reconstructie tik je op
   *Kopieer beeldprompt*, genereert het beeld in ChatGPT, Higgsfield of een ander programma, en kiest het
   bestand met *Eigen hoofdfoto kiezen*. De app zet er automatisch het reconstructielabel op.
2. **Eigen server:** stel onder *Instellingen → Eigen generatieserver* een adres in. Per post verschijnt dan
   *Genereer via eigen server*. De app stuurt `POST /api/image` met `{prompt, ratio}` en verwacht een
   PNG/JPEG/WebP terug.

Echte historische beelden blijven de eerste keus: de Commons-zoeker en de zoeklinks staan bij elke post vóór de AI-knoppen.

## Aanbevolen opzet voor later

**Eén kleine serverless functie** (bijv. Cloudflare Workers of Vercel Functions, beide met een gratis laag)
die tussen de app en een beeld-API zit.

```
Telefoon (app) ──HTTPS──▶ /api/image (jouw functie) ──▶ beeld-API (OpenAI, Google, FLUX via fal.ai/Replicate)
                          • API-sleutel staat alleen hier
                          • toegangscode controleren
                          • daglimiet (bijv. max. 10 beelden/dag)
                          • resultaat terug als PNG
```

Waarom zo:

- **Veilig:** de API-sleutel staat nooit in de HTML of op de telefoon. De app stuurt alleen een toegangscode,
  en die wordt niet bewaard.
- **Goedkoop:** er wordt alleen gegenereerd als je per post op de knop tikt; nooit automatisch voor een hele
  batch. Een daglimiet in de functie voorkomt verrassingen op de rekening. Beeld-API's rekenen per beeld;
  reken op enkele centen tot circa tien cent per beeld, afhankelijk van model en kwaliteit. Controleer de
  actuele prijslijst van de gekozen aanbieder voordat je begint, want die verandert vaak.
- **Eenvoudig:** geen extra stappen per beeld. Prompt → knop → kaart.

### Eén aandachtspunt: hoe je de app opent

De bestaande backend-koppeling gebruikt een inlogcookie (`credentials: 'include'`). Als je de app als los
bestand opent (bijv. vanuit Downloads op Android), heeft de pagina geen eigen domein en weigeren browsers zulke
cookies vaak. Twee oplossingen:

1. **Aanbevolen:** host de app en de functie op hetzelfde domein (bijv. Cloudflare Pages met een Worker-route
   `/api/*`). Dan is er geen CORS-probleem meer, ook niet voor museum- en archiefbeelden via een eigen proxy.
2. Of laat de functie in plaats van een cookie een kortlevende sleutel teruggeven die de app per sessie in het
   geheugen houdt en als `Authorization`-header meestuurt.

### Modelkeuze

- Vraag in de prompt om een **historisch terughoudende reconstructie** (dat doet `imagePrompt()` in de app al):
  geen verzonnen opschriften, geen herkenbare historische gezichten, geen onbewezen gebeurtenissen.
- Laat het label *Illustrated reconstruction* altijd staan; de app tekent het automatisch op elke reconstructie.
- Kies één aanbieder en test 10 typische TDA-onderwerpen voordat je een abonnement of tegoed koopt.

### Wat er in de app nog moet gebeuren als de functie bestaat

Niets aan de bediening: de knop verschijnt zodra het serveradres is ingevuld. Wel aan te raden: de
cookie-login vervangen door de header-variant (optie 2 hierboven) als je de app als los bestand blijft openen.
