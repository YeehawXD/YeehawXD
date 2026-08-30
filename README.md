# Hulen

En enkelt side, der sætter Platons hulelignelse op som noget, man er inde i
frem for noget, man læser om: en stenvæg, en ild, der flakker bag ryggen, og
skygger, der bliver båret forbi. Otte citater fra græske filosoffer om,
hvorfor det, man ser hele tiden, holder op med at føles som noget, man ser —
og begynder at føles som virkeligheden.

Sangen "Sometimes" (Mattyeux, Princess Chelsea, Videoclub) spiller i
baggrunden.

## Sådan åbner du den

Dobbeltklik på `index.html`. Det er hele installationen — én fil, ingen build,
ingen afhængigheder.

Vil du hellere have den på nettet, kan `index.html` lægges direkte på GitHub
Pages, Netlify, Vercel eller en hvilken som helst webserver. På GitHub Pages:
**Settings → Pages → Source: Deploy from a branch**, vælg denne branch og
mappen `/ (root)`.

## Oplæsningen

En dyb britisk stemme læser citatet op, når man træder ind og hver gang man går
videre. Det er rigtige optagelser, lavet på forhånd med en neural stemme og
lagt i `tale/` — ikke browserens talesyntese, som lyder metallisk, fordi
systemernes standardstemmer er komprimerede.

Filerne er genereret med `edge-tts` og stemmen `en-GB-RyanNeural` ved `-10%`
tempo og `-3Hz`, ud fra den engelske linje på hvert citat. Skal de laves om,
er teksterne feltet `en` i citatlisten. Højttalerknappen slår oplæsningen fra
og til, og valget huskes. Kan filerne ikke afspilles, falder siden tilbage på
browserens egen stemme.

## Lyden

Browsere må ikke starte lyd af sig selv, derfor det første klik ("Træd ind i
hulen"). Bagefter forsøger siden tre kilder i rækkefølge:

Hulen spiller sin egen baggrundslyd, som browseren selv laver: en dyb
grundtone af to oscillatorer sat 0,35 Hz fra hinanden, så de svæver mod
hinanden, og hvid støj gennem et lavpasfilter med et langsomt åndedrag. Den
henter intet og virker derfor overalt. Den trækker sig, mens der bliver læst op.

Oven på den kan selve sangen spille. Siden forsøger i rækkefølge:

1. `media/sometimes.mp3` — din egen fil, hvis du har lagt en (se `media/README.md`)
2. Den officielle musikvideo på YouTube, afspillet skjult, så kun lyden høres
3. Et panel med link til Spotify, en kopiknap og selve adressen

Panelet findes, fordi et link med `target="_blank"` bliver blokeret lydløst i
nogle indlejringer. Et link, der intet gør, er værre end ingen knap — panelet
viser sig altid.

Det betyder, at siden aldrig går i stå, uanset hvad der er blokeret i den
browser, den bliver åbnet i. Afspilleren nede i hjørnet viser hvilken kilde,
der kører, og kan pause.

## Citaterne

Den græske tekst følger de gængse udgaver (Burnet / Perseus). Oversættelserne
er gengivet frit, men tro mod meningen.

| # | Kilde | Om |
|---|---|---|
| 1 | Platon, *Staten* VII, 514b | Skærmbrættet, figurerne bliver båret hen over |
| 2 | Platon, *Staten* VII, 515a | "De ligner os" |
| 3 | Platon, *Staten* VII, 515c | Skyggerne *er* virkeligheden for dem, der kun har set dem |
| 4 | Sofokles, *Aias* 125–126 | Vi, der lever, er ikke andet end en flygtig skygge |
| 5 | Heraklit, fragment B21 | Alt vi ser vågne, er død |
| 6 | Heraklit, fragment B107 | Øjne og ører er dårlige vidner |
| 7 | Demokrit, fragment B117 | Sandheden ligger i en afgrund |
| 8 | Euripides, fragment 638 | Hvem ved, om livet er død |
| 9 | Marcus Aurelius, *Meditationer* V, 16 | Sjælen farves af sine billeder |
| 10 | Aristoteles, *Den nikomacheiske etik* II, 1103b | Gentagelsen bliver til karakter |
| 11 | Epiktet, *Håndbogen* 5 | Ikke tingene, men forestillingerne om dem |
| 12 | Marcus Aurelius, *Meditationer* IV, 35 | Alt varer én dag |
| 13 | Sofokles, *Oidipus i Kolonos* 1224–1227 | Aldrig at være født |
| 14 | Platon, *Staten* VII, 517a | De ville slå ham ihjel |
| 15 | Platon, *Staten* VII, 516b | Vejen ud, og solen |

Marcus Aurelius var romersk kejser og ikke græker, men skrev på græsk; det
står på hans kort. De øvrige er græske.

Buen går fra skærmen, over hvad vi selv er lavet af, ned gennem det mørkeste
de skrev, og ud ad hulen igen.

## Betjening

- **Videre / Tilbage**, piletasterne, mellemrumstasten — eller stryg til siden
- Tælleren nederst viser, hvor langt man er
- Jo længere man kommer, jo mere dør ilden ud, og jo mere dagslys siver ind
  ovenfra — man er på vej ud af hulen
