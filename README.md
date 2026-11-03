# ELIZA — ricostruzione conversazionale locale

Questa applicazione web, realizzata da [e38 srl](https://e38.it), ricrea nel browser,
con regole esplicite e contenuti in italiano, alcuni meccanismi dell’ELIZA storica di
Joseph Weizenbaum. È un esperimento conversazionale, non un sistema che comprende il
linguaggio.

> **Avvertenza:** ELIZA non è una professionista, non fornisce consulenza o assistenza
> psicologica e non sostituisce una persona qualificata o un servizio di emergenza.
> Le risposte sono prodotte da regole e possono essere inappropriate o fuorvianti.

L’interfaccia è un terminale essenziale a fosfori verdi o ambra, selezionabili nelle
impostazioni. Il richiamo estetico al PDP-9
non è una ricostruzione filologica né afferma che l’ELIZA storica funzionasse su quel
computer. Questa versione italiana non è una traduzione del copione DOCTOR né una
riproduzione storicamente equivalente.

## Funzionamento e privacy

L’applicazione è composta da asset statici ed esegue le regole nella scheda del browser.
Runtime e build non richiedono backend, codice o compilazione C++, librerie NLP, LLM o
API applicative. Non effettua tracking e non salva automaticamente conversazioni, seed o
tracce. Cronologia e stato restano nella memoria volatile della scheda e si perdono
chiudendola o ricaricando la pagina. `EXPORT` scarica su richiesta la cronologia e le
tracce; `DELETE SESSION`, dopo conferma, elimina i dati della sessione corrente.

L’app non include un service worker né storage offline persistente e non è una PWA
offline. Dopo che la pagina e gli asset sono stati caricati, l’app può continuare a
funzionare nella scheda senza rete. Dopo la chiusura del browser, invece, un’apertura a
freddo richiede nuovamente accesso agli asset tramite il sito o il server statico: non è
promesso che funzioni offline.

## Avviso locale di sicurezza

Per alcune formulazioni esplicite relative a pericolo immediato, un insieme ristretto di
regole locali può mostrare un messaggio statico con l’indicazione di contattare il 112 o
il numero di emergenza locale e una persona fidata. Non è una valutazione del rischio,
una diagnosi o un servizio di assistenza: il riconoscimento è limitato e può non rilevare
una situazione o interpretare correttamente il contesto.

## Modalità e comandi

Le modalità si selezionano dall’interfaccia o con un comando:

- `MODE HISTORICAL` richiama i meccanismi documentati della baseline: rotazione delle
  ricomposizioni e hash Hollerith per le scelte di memoria. Il copione italiano non è
  quello storico inglese.
- `MODE DETERMINISTIC` usa la stessa rotazione e lo stesso hash di `HISTORICAL`, senza
  scelte pseudo-casuali. A differenza della modalità storica, riconosce un messaggio
  consecutivo ripetuto e usa una risposta dedicata.
- `MODE VARIED` usa un generatore pseudo-casuale inizializzato dal seed per scegliere
  tra alternative già scritte nelle regole, comprese quelle di memoria. Non genera testo
  libero; seed e stessa sequenza di input rendono ripetibili le scelte.

I comandi sono locali; `*` può essere usato come prefisso facoltativo.

| Comando | Azione |
| --- | --- |
| `HELP`, `ABOUT` | Mostra aiuto e informazioni sull’esperimento. |
| `MODE HISTORICAL`, `MODE DETERMINISTIC`, `MODE VARIED` | Cambia modalità e azzera lo stato del motore. |
| `SEED <0–4294967295>` | Imposta il seed a 32 bit e azzera lo stato del motore; la variazione si applica in modalità `VARIED`. |
| `TRACE ON`, `TRACE OFF` | Attiva o disattiva la traccia locale delle regole. Può includere parti dell’input. |
| `CLEAR` | Pulisce la vista, ma conserva cronologia e stato in memoria. |
| `RESET` | Azzera stato del motore e tracce; conserva cronologia visibile, modalità e seed. |
| `DELETE SESSION` | Dopo conferma elimina cronologia e tracce e prepara una nuova sessione volatile. |
| `EXPORT` | Scarica su richiesta una copia testuale della cronologia e delle tracce. |
| `SPEED <0–80>` | Imposta la velocità di visualizzazione in millisecondi per carattere. |
| `MOTION ON`, `MOTION OFF` | Attiva o disattiva gli effetti di movimento. |
| `THEME GREEN`, `THEME AMBER` | Seleziona i fosfori verdi o ambra. |

### Come conversare

Scrivi in italiano un pensiero o un argomento concreto, poi prova ad aggiungere
dettagli alle domande di ELIZA. Il motore non comprende il testo: applica regole,
riformula alcune frasi e può richiamare messaggi precedenti; una risposta può quindi
sembrare fuori tema. Modalità e sequenza degli scambi possono cambiare le risposte.

Esempio di una sequenza in modalità `HISTORICAL`:

```text
TU: La mia bicicletta è rossa.
ELIZA: Che cosa rappresenta per te questa cosa?
TU: xyzzy
ELIZA: Puoi raccontarmi qualcosa in più?
TU: blorb
ELIZA: Tengo presente «La mia bicicletta è rossa». Su quale parte vuoi soffermarti?
```

Le parole senza corrispondenze attivano risposte generiche; in questo esempio, dopo
alcuni messaggi, ELIZA richiama un input precedente dalla memoria. È un esperimento
conversazionale, non una terapeuta e non offre assistenza o consulenza psicologica.
Digita `HELP` nell’app per leggere la guida e l’elenco dei comandi locali.

Il colore è verde all’avvio e la scelta rimane nella scheda senza essere salvata.
Modalità, seed e contatore degli scambi sono disponibili nelle impostazioni, ma non sono
necessari per la conversazione: il seed rende riproducibili le scelte di `MODE VARIED`
e il contatore registra i messaggi inviati al motore o alla verifica di sicurezza.

## Sviluppo

Requisiti dichiarati in `package.json`: Node.js `^22.13.0 || ^24.0.0 || >=26.0.0`
e npm `>=10`.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Il comando Playwright usa Chromium e un’anteprima statica locale; non avvia servizi
applicativi. `npm run build` include il typecheck. Per istruzioni di distribuzione,
consulta la [guida al deployment](docs/deployment.md).

## Build e deployment

Pubblica tutti i file generati in `dist/` su un host statico. Vite usa una base relativa,
quindi gli asset possono essere serviti anche da un sottopercorso. Non serve un backend.

## Crediti, fonti e licenze

ELIZA fu ideata da Joseph Weizenbaum; il riferimento storico principale è il suo articolo
del 1966, [“ELIZA—A Computer Program for the Study of Natural Language Communication
Between Man and Machine”](https://web.stanford.edu/class/linguist238/p36-weizenabaum.pdf).
Il lavoro di ricostruzione e la documentazione di **Anthony Hay** sono una fonte di
riferimento per i meccanismi storici. La baseline è consultabile nella storia Git al
[commit `30eb61bc1c36a439b344276110e4942a42b0e7a4`](https://github.com/anthay/ELIZA/tree/30eb61bc1c36a439b344276110e4942a42b0e7a4);
non fa parte del bundle di questa applicazione.

La licenza [CC0 1.0 Universal](LICENSE) riguarda i diritti che i rispettivi titolari
possono concedere; non attribuisce automaticamente diritti su marchi o materiali di
terzi, come l’articolo, il copione DOCTOR o le trascrizioni storiche. Le regole italiane
sono una rielaborazione locale. Per dettagli e ulteriori fonti, consulta
[fonti e licenze](docs/sources-and-licenses.md) e la [baseline storica](docs/historical-baseline.md).
