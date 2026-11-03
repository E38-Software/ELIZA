# Architettura runtime

## Stato attuale

L'applicazione conversazionale attiva è una pagina statica: [index.html](../index.html) carica [src/main.ts](../src/main.ts), che avvia [src/ui/app.ts](../src/ui/app.ts) e gli stili Tailwind. L'esecuzione della conversazione avviene nel browser. Non c'è backend, API, servizio linguistico o chiamata remota; il build TypeScript/Vite non compila C++.

I sorgenti C++ storici sono stati rimossi dal checkout corrente; la baseline resta consultabile nello storico al commit [30eb61bc1c36a439b344276110e4942a42b0e7a4](https://github.com/anthay/ELIZA/tree/30eb61bc1c36a439b344276110e4942a42b0e7a4). La pagina [src/eliza.html](../src/eliza.html), JavaScript autonoma con il copione DOCTOR storico, è ancora presente ma non è l'entry point di questa app. La nuova applicazione italiana è una reinterpretazione locale, non un porting equivalente del copione storico.

Dopo il caricamento della pagina e delle sue risorse, la conversazione può continuare offline nella scheda. Non sono implementati service worker o cache applicativa automatica, quindi l'avvio a freddo offline non è garantito.

## Flusso e moduli

```text
index.html → src/main.ts → src/ui/app.ts
                               ├─ safety/SafetyOverride.ts
                               └─ language/it/index.ts → core/ElizaEngine.ts
                                    ├─ KeywordMatcher / DecompositionMatcher
                                    ├─ ReassemblyEngine / ResponseSelector
                                    └─ MemoryStore / SeededRandom
```

- **UI:** terminale conversazionale a fosfori verdi o ambra con DOM nativo, input e cronologia in memoria volatile. I messaggi sono renderizzati come testo. Sono presenti comandi e controlli locali per modalità, seed, traccia, movimento e sessione; l'esportazione della cronologia è esplicita e genera un file locale.
- **Safety:** prima di chiamare il motore, la UI passa l'input a regole regex locali. Un riscontro mostra un messaggio statico e salta il motore. È un insieme di pattern limitato, non una valutazione clinica o un classificatore generale.
- **Lingua italiana:** `createItalianEngine` combina il copione locale con normalizzazione, tokenizer e riflessioni tipizzate. Le keyword e le risposte sono tabelle curate, non generate da un modello.
- **Core:** `ElizaEngine` mantiene stato mutabile per istanza: turno, `LIMIT`, input precedente, memoria FIFO, seed e indici di selezione. `reset`, cambio modalità e cambio seed azzerano lo stato del motore; non viene salvato automaticamente su storage browser.

## Elaborazione di una richiesta

Il motore limita l'input elaborato a 4096 unità UTF-16 e 512 token. Cerca keyword e costruisce uno stack secondo priorità e ordine di scansione, considera la prima clausola con un match, poi prova le decomposizioni nell'ordine dichiarato. Il primo pattern compatibile fornisce le catture per la ricomposizione. Redirect e `NEWKEY` possono continuare il ciclo, con un limite di 64 passaggi.

Sono distinti input vuoto, ripetizione, keyword senza decomposizione compatibile e assenza di keyword; ciascuno usa la relativa risposta o fallback configurato. La memoria è FIFO senza limite di capacità imposto da `MemoryStore`; la regola del copione determina quando accodare, mentre il motore la richiama solo senza keyword quando `LIMIT` raggiunge 4.

Le risposte italiane usano il tu e fallback testuali locali. Il core supporta riflessioni su catture dichiarate e un `unsafeFallback`; il copione italiano attuale non dichiara riflessioni sulle sue regole di risposta. Le riflessioni sono usate dal percorso di memoria per la selezione hash; quando sono insicure, quel percorso usa il testo originale per l'hash.

## Selezione, memoria e traccia

Le modalità `historical`, `deterministic` e `varied` sono implementate nel core; dettagli e differenze sono in [stochastic-behaviour.md](./stochastic-behaviour.md). La traccia strutturata è prodotta dal motore e può contenere l'input. La UI la conserva in memoria locale solo quando richiesta. `CLEAR` pulisce lo schermo ma non lo stato; reset e cancellazione sessione hanno effetti diversi. Non c'è persistenza automatica; l'esportazione è un'azione esplicita locale.

## Interfaccia

La riga del terminale accetta messaggi e comandi locali; `HELP` elenca i comandi disponibili. Le sezioni «Traccia locale» e «Impostazioni» sono ripiegabili e raccolgono i controlli locali, la modalità, il seed e il contatore degli scambi. Il colore dello schermo è selezionabile fra verde e ambra e non viene salvato automaticamente. L'aspetto richiama i terminali storici, senza essere una ricostruzione filologica del PDP-9.

## Test e verifiche

Nel repository esistono test unitari, d'integrazione e Playwright, oltre a una workflow CI configurata. Questa descrizione non attesta che test o build siano stati eseguiti o superati.
