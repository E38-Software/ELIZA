# Build e deployment

## Runtime e output

L'entry point statico è `index.html`, che carica `src/main.ts`. Vite è configurato con `base: './'`; l'app usa TypeScript, DOM nativo e CSS compilato con Tailwind. Non sono richiesti backend, API, servizi conversazionali o rete per la logica dell'app. Distribuire gli asset statici generati da Vite su un web host; non è necessario un processo server applicativo.

I sorgenti C++ sono stati rimossi dal checkout corrente; la baseline resta consultabile nello storico al commit [30eb61bc1c36a439b344276110e4942a42b0e7a4](https://github.com/anthay/ELIZA/tree/30eb61bc1c36a439b344276110e4942a42b0e7a4). La pagina storica [src/eliza.html](../src/eliza.html) è presente ma non è l'entry point corrente. La UI è un terminale conversazionale a fosfori verdi o ambra, con comandi e controlli locali ripiegabili.

Dopo aver caricato la pagina e le sue risorse, la logica conversazionale locale non richiede rete e può continuare a essere usata offline nella scheda. L'avvio a freddo senza rete non è garantito: non è implementato un service worker, una PWA o una cache applicativa automatica.

## Requisiti dichiarati

- Node.js minimo 22.13.0; `engines` dichiara `^22.13.0 || ^24.0.0 || >=26.0.0` (quindi Node 23 e 25 non sono inclusi), npm `>=10`.
- Vite 8.3.5, Vitest 5.1.0, Tailwind CSS 3.4.19, Playwright 1.63.0.
- TypeScript 5.9.3, ESLint 10.14.0 e Prettier 3.6.2.
- La workflow CI configura Node.js 26 e installa Chromium per Playwright.

Il package è configurato come ESM (`type: module`); il tooling ESLint 10 richiede una versione Node compatibile, coperta dai requisiti del progetto e dalla CI su Node 26. Gli strumenti sono dichiarati in `devDependencies`: non aggiungono dipendenze runtime all'app statica.

Un override npm forza `minimatch` a `^11.0.4` per mitigare un advisory DoS nel grafo di dipendenze del tooling. È una misura temporanea: rimuoverla quando gli upstream che consumano `minimatch` dichiareranno una versione sicura compatibile, aggiornando lockfile e verificando nuovamente l'audit. Il team riporta `npm install` e `npm audit` con zero vulnerabilità dopo l'aggiornamento; questo risultato non è stato rieseguito né verificato in questo aggiornamento documentale.

## Comandi disponibili

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run preview
npm run test:e2e
```

`npm run build` esegue il typecheck e poi `vite build`; `npm run dev` serve in locale su loopback. La workflow CI è configurata per installare dipendenze, eseguire controlli, test, build ed e2e. La presenza dei comandi e della workflow descrive la configurazione, non il loro esito.

Questo documento non attesta l'esito dei controlli, della build o del deployment.
