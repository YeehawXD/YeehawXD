# Fantasy Kritter som app

Spillet er én HTML-fil uden afhængigheder. Begge app-projekter herunder er
derfor tynde skaller om præcis den fil — iOS-appen viser den i en `WKWebView`,
desktop-appen i et Electron-vindue. Der er ingen server, ingen netværkskald og
ingen billedfiler: al grafik tegnes i kode, når appen kører.

```
app/
  ios/        Xcode-projekt  → .app / .ipa til iPhone og iPad
  desktop/    Electron       → .exe (Windows), .dmg (macOS), .AppImage (Linux)
```

---

## Før begge dele: byg spillet ind i skallerne

```bash
node tools/app.js      # lægger spillet ind i begge projekter
node tools/icon.js     # tegner app-ikonerne (kræver Chromium, kun nødvendigt én gang)
```

`tools/app.js` samler `index.html`, `css/` og `js/` til én fil og skriver den
tre steder: `dist/`, `app/ios/FantasyKritter/web/` og `app/desktop/web/`.

**Det her er det vigtigste at huske:** filerne inde i `app/` er *genererede*.
Ret aldrig i dem — ret i `js/` og `css/` og kør `node tools/app.js` igen.
Kopierne i `app/` har en advarsel øverst netop derfor.

Vil du kontrollere at den samlede fil virker, før du pakker den:

```bash
node tools/shots.js --bundle
```

Den spiller spillet igennem i Chromium på den fil appen rent faktisk sender med,
og fejler hvis der kommer bare én konsolfejl.

---

## iOS — Xcode

```bash
open app/ios/FantasyKritter.xcodeproj
```

Projektet åbner klar til at køre. Ét mål, to Swift-filer, ingen pakker at hente.

1. Vælg **FantasyKritter** i skema-vælgeren øverst og en simulator.
2. Tryk ▶︎. Spillet starter direkte.

**For at køre på din egen telefon** skal du sætte dit udviklerhold på:
markér projektet i sidebaren → target **FantasyKritter** → fanen
**Signing & Capabilities** → vælg dit **Team**. Bundle-ID'et er
`com.fantasykritter.game`; skift det hvis det er optaget.
En gratis Apple-ID virker fint — appen kører så syv dage ad gangen,
og du geninstallerer den bare bagefter.

### Hvad de to Swift-filer gør

`AppDelegate.swift` laver vinduet. `GameViewController.swift` laver en
`WKWebView`, slår scroll fra (spillet styrer selv sit layout) og serverer
`web/`-mappen fra app-bundtet. Går det galt — typisk hvis `web`-mappen ikke er
kommet med i **Copy Bundle Resources** — vises en besked i stedet for en sort
skærm.

**Hvorfor ikke bare `loadFileURL`?** Fordi gemte rejser så ville forsvinde.
WKWebView giver `file://`-sider en uigennemsigtig oprindelse, og `localStorage`
på sådan en er upålidelig: den kan tie stille og ikke gemme noget, eller blive
smidt væk mellem to starter af appen. Spillet gemmer hver rejse i
`localStorage` og sluger med vilje skrivefejl, så resultatet ville være
"appen gemmer aldrig mine ting" uden en eneste linje i loggen.

I stedet serveres spillet over sit eget schema, `kritter://game/index.html`,
gennem en `WKURLSchemeHandler`, der læser filerne direkte ud af bundtet. Det
giver en helt normal, vedvarende oprindelse. Det er præcis samme grund til, at
Capacitor og Ionic gør det på den måde. Desktop-appen gør det tilsvarende.

`web` ligger i projektet som en *mappereference* (blå mappe), så mappestrukturen
overlever ind i bundtet. Bliver den ved et uheld til en gul gruppe, ryger
`subdirectory: "web"` og appen kan ikke finde filen.

### Ikonet

`Assets.xcassets/AppIcon.appiconset/icon-1024.png` er tegnet af spillets egen
kode via `tools/icon.js` — samme Rodde, samme lys, samme streger som i spillet.
Den er gemt uden alfakanal, fordi App Store-validering afviser app-ikoner med
gennemsigtighed.

---

## Desktop — Electron og .exe

```bash
cd app/desktop
npm install
npm start          # kør spillet som skrivebordsapp
```

`npm install` henter Electron og electron-builder. Det er de eneste to
afhængigheder i hele projektet, og de bruges kun til at pakke — selve spillet
har stadig ingen.

### Byg installationsfiler

```bash
npm run dist:win     # Windows: installer (.exe) + portabel (.exe)
npm run dist:mac     # macOS:   .dmg + .zip, Intel og Apple Silicon
npm run dist:linux   # Linux:   .AppImage
npm run dist         # den platform du står på
```

Resultatet lander i `app/desktop/dist/`.

Windows-bygningen laver to filer. Installeren spørger om placering og laver en
genvej. Den portable `.exe` er én fil, der bare kan køres — den er nok den, du
er ude efter, hvis du vil sende spillet til nogen.

**Kan man bygge Windows-`.exe` fra en Mac?** Ja. `npm run dist:win` er
afprøvet på en ikke-Windows-maskine og producerede både installeren og en
portabel `Fantasy-Kritter-portable-1.0.0.exe` — rigtige PE-binære filer med
ikonet og navnet indlejret. electron-builder henter selv det NSIS-værktøj, den
skal bruge; Wine er ikke længere nødvendigt.

Det, du *ikke* kan gøre uden for Windows, er at signere med et rigtigt
certifikat. Uden signering viser Windows en SmartScreen-advarsel første gang
(**Mere info ▸ Kør alligevel**), og usignerede macOS-bygninger kræver
højreklik ▸ **Åbn**. Det forsvinder først med et betalt udviklercertifikat, og
det er en pris, ikke en fejl.

Vil du hellere have bygningerne lavet på de rigtige maskiner — og en signeret
kæde senere — så ligger opskriften klar: gå til fanen **Actions** på GitHub,
vælg **Byg desktop-app** og tryk **Run workflow**. Den bygger alle tre
platforme parallelt, og filerne hentes under **Artifacts**. Se
[`.github/workflows/desktop.yml`](../.github/workflows/desktop.yml).

### Vinduet

Spillet er tegnet til en telefon i stående format, så vinduet holder det
formatforhold i stedet for at strække layoutet. `main.js` låser
`setAspectRatio` og åbner aldrig højere end skærmen — på en 768 px bærbar ville
et fast 900 px vindue skubbe den nederste række ud af billedet.

Renderen kører i sandkasse uden Node-adgang og helt uden preload-bro. Den
behøver ingen: spillet gemmer i `localStorage` og laver selv sin lyd i WebAudio,
så der er intet, siden skal spørge hovedprocessen om.

Ligesom på iOS loades spillet ikke fra `file://`, men fra et registreret
schema — `kritter://game/index.html` — så siden får en almindelig oprindelse og
`localStorage` overlever, at appen lukkes. `protocol.handle` læser filerne fra
`web/`-mappen og afviser alt, der prøver at læse uden for den.

---

## Hvis noget går galt

| Symptom | Årsag |
| --- | --- |
| Sort skærm i simulatoren | `web`-mappen mangler i Copy Bundle Resources, eller den er blevet en gul gruppe i stedet for en blå mappereference |
| Beskeden "Spillet blev ikke fundet" | Samme sag — controlleren fanger den med vilje, så fejlen kan ses |
| Hvidt vindue i Electron | `app/desktop/web/index.html` findes ikke. Kør `node tools/app.js` |
| Ikonet er en grå firkant | Kør `node tools/icon.js` |
| Ændringer i spillet slår ikke igennem | Du har rettet i `js/`, men ikke kørt `node tools/app.js` bagefter |
