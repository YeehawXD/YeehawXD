# Fantasy Kritter

En taktisk auto-battler-roguelite fra De Skæve Lande. Saml et hold skæve
væsner, stil dem op på et 3×2-bræt, og kæmp gennem tre regioner.

Åbn `index.html`. Det er hele installationen — ingen byggetrin, ingen
afhængigheder, intet netværk. Det kører fra `file://`, offline, på en telefon
eller en computer.

Vil du have det som rigtig app — Xcode-projekt til iPhone, `.exe` til Windows —
står opskriften i **[`app/README.md`](app/README.md)**.

![Holdet](shots/critters.png)

---

## Spillet

**Opstillingen er gåden.** Hver side kæmper fra et 3×2-bræt. Forreste række
tager alle nærkampsslag, og bagerste række kan ikke rammes, før den forreste
falder. Hvor en kritter står, ændrer altså både hvad den gør, og hvad der sker
med den.

**Bånd gør brættet til en beslutning.** Hver kritter har et bånd — en bonus for
at stå ved siden af en bestemt allieret eller i den rigtige række. Bånd tælles
mod naboer vandret og lodret, så at flytte én kritter kan ændre tre andre. Der
findes ingen rigtig opstilling, kun den bedste for det hold, du har lige nu.

**Regioner handler om tempo, ikke bare skade.** De fem regioner er samtidig
typesystemet, og de danner én ring:

```
Sump → Skov → Sten → Ild → Frost → Sump
```

Et angreb med fordel gør 1,5× skade **og** oplader ultimaten 50 % hurtigere.
Et angreb ind i modstand gør 0,7×. At ramme rigtigt er derfor et valg om, hvornår
dine ultimater kommer online — ikke kun et skadestal.

**Ultimaterne er det, du faktisk spiller.** Kritterne oplader energi ved at give
og tage skade. Ved fuld opladning lyser portrættet, og du trykker for at fyre af.
At holde en heling ét sekund længere, eller en bedøvelse til fjenden har bundet
sig, er der hvor kampe vindes. `Auto` findes, hvis du hellere vil se på.

**Rejsen er en række valg.** Tre akter — Mumleskoven, Det Syngende Træsk og
Emberhulen — hver et forgrenet kort med kampe, elitekampe, butikker, lejre,
gemmer og en boss. Liv bæres med mellem kampe, så en billig sejr er mere værd
end en flot. Mister du hele holdet, er rejsen slut.

Syv spilbare kritter, fem regioner, fem roller, fjorten relikvier, fem kritter
på brættet ad gangen. Ingen timere, ingen energimålere, ingen køb, ingen gacha.
Alt tjenes ved at spille.

### Holdet

| Kritter | Region | Rolle |
| --- | --- | --- |
| Rodde | Skov | Tank |
| Grumle | Sten | Tank |
| Glimt | Frost | Skader |
| Sjatte | Sump | Støtte |
| Puddel | Skov | Kontrol |
| Knog | Frost | Kontrol |
| Askeøje | Ild | Snigmorder |

Fjenderne — Skovtyv, Mosekone, Slaggehund og bossen Gnavrod — er egne designs,
ikke omfarvede spillerfigurer.

---

## Styring

| Handling | Sådan |
| --- | --- |
| Flyt en kritter | Tryk på den, og tryk så på en plads. Trykker du på en optaget plads, byttes de |
| Stil op automatisk | ↻-knappen på opstillingsskærmen |
| Fyr en ultimate af | Tryk på et lysende portræt, eller tast `1`–`6` |
| Skift tempo | `1×`-knappen under kampen |

---

## Sådan er det bygget

Almindelig JavaScript i klassiske `<script>`-tags, så det loader fra filsystemet
uden server og uden bundler.

| Fil | Hvad den ejer |
| --- | --- |
| `js/util.js` | Matematik, farver, seeded tilfældighed, gemte data |
| `js/audio.js` | Al lyd, syntetiseret med WebAudio |
| `js/draw.js` | Materialer, lys og stregtykkelser — værktøjskassen |
| `js/critterart.js` | Én håndbygget tegnerutine per kritter |
| `js/icons.js` | Alle ikoner, tegnet som glyffer i stedet for emoji |
| `js/scenery.js` | Parallakse-baggrunde |
| `js/roster.js` | Regioner, roller og karakterdata |
| `js/combat.js` | Kampsimuleringen — ingen DOM, kører headless |
| `js/run.js` | Kortgenerering, møder, relikvier, belønninger |
| `js/battleview.js` | Tegning af en kamp |
| `js/ui.js` | Skærme og kampløkken |
| `js/main.js` | Opstart og global sammenkobling |

### Grafikken er kode

Der findes ikke én billedfil i projektet. Hver kritter er en tegnerutine, og de
deler ét lys (oppefra venstre), ét sæt materialer og tre bevidste
stregtykkelser.

Det er ikke bare en optimering. Designbiblens silhuetregel siger, at en kritter
skal kunne kendes i ren sort, og at to figurer med samme omrids skal
*gentegnes*, ikke omfarves. Den regel kan en skabelon med udskiftelige ører
aldrig opfylde — for skabelonen *er* silhuetten. Derfor er hver figur bygget
for sig oven på `js/draw.js`, med tilbehør der med vilje bryder omridset:
Roddes bladører og nøddetaske, Grumles meteorhammer, Knogs alt for store hjelm.

`node tools/sheet.js` tegner hele holdet både normalt og i ren sort, så
silhuettesten kan ses frem for at blive påstået.

### Sådan efterprøves det

Tre harnesker, alle headless:

```bash
node tools/sim.js 100        # spil 100 hele rejser, rapportér sværhedskurven
node tools/shots.js          # kør spillet i Chromium, fejl ved enhver konsolfejl
node tools/shots.js --bundle # samme tur, men på den fil apperne sender med
node tools/sheet.js          # kontaktark med silhuettesten
node tools/icon.js           # tegn app-ikonerne
node tools/app.js            # byg spillet ind i Xcode- og Electron-projektet
```

`tools/sim.js` spiller hele rejser med en bevidst grov strategi — automatisk
opstilling, ultimater så snart de er klar, grådige belønninger. Den findes for
at svare på et spørgsmål, man ikke kan se sig til: er spillet vindbart, og
bliver det sværere? Dødsfald der stiger akt for akt og samler sig om bosser og
elitekampe er den form, en roguelite skal have. En spiller der tænker over bånd
og holder sine ultimater, skal slå den bot; en sjusket spiller skal ikke.

`tools/shots.js` klikker sig gennem det rigtige spil i Chromium — titel, kodeks,
opstilling, en hel kamp, en belønning — og afslutter med fejlkode ved enhver
konsolfejl. To fejl den fangede, som ingen mængde læsning ville have fanget: en
baggrundsløkke der trådte i `bredde / 8` og hang i det uendelige, når lærredet
endnu ikke havde fået en størrelse, og en statusfarvning tegnet med
`source-atop`, der farvede hele banen i stedet for figuren.

---

## Design

Alt visuelt følger **Fantasy Kritter – Spil Design Bibel**, som ligger i
`docs/design-bible.txt`. Den er eneste kilde til farver, lys, silhuetter,
materialer, ikoner og hvordan en kamp skal føles.

---

## Licens

Gør hvad du vil med det.
