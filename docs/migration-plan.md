# Piano di migrazione

## Vincoli del risultato

- Applicazione statica con TypeScript `strict`, Vite e Tailwind; distribuzione come asset browser.
- Nessun backend, API, telemetria, servizio NLP, modello remoto o requisito C++ in build, test e runtime.
- I sorgenti C++ non fanno parte del target. La baseline analizzata è recuperabile nello storico Git al commit [`30eb61bc1c36a439b344276110e4942a42b0e7a4`](https://github.com/anthay/ELIZA/tree/30eb61bc1c36a439b344276110e4942a42b0e7a4); i riferimenti puntuali sono fissati a [eliza.cpp upstream](https://github.com/anthay/ELIZA/blob/30eb61bc1c36a439b344276110e4942a42b0e7a4/src/eliza.cpp), [eliza.html upstream](https://github.com/anthay/ELIZA/blob/30eb61bc1c36a439b344276110e4942a42b0e7a4/src/eliza.html) e [adattatori seriali upstream](https://github.com/anthay/ELIZA/tree/30eb61bc1c36a439b344276110e4942a42b0e7a4/src). Sono riferimenti storici, non file locali da conservare né requisiti del progetto.
- La logica linguistica nuova è un insieme dichiarativo e tipizzato di regole esplicite, non NLP. Ogni copione italiano è una reinterpretazione locale; non va dichiarato traduzione equivalente del DOCTOR inglese.

## Sequenza proposta

### 1. Congelare la baseline documentale

Usare [l'analisi della codebase](./codebase-analysis.md) come specifica dei comportamenti osservati. Trattare lo snapshot Git indicato sopra come unica fonte del vecchio codice. L'analisi storica non deve essere convertita in copia C++ locale, né le istruzioni C++ del [README](../README.md) devono essere scambiate per istruzioni del target.

### 2. Definire i contratti TypeScript

Separare tipi delle regole, token, segmenti catturati, risultato di trasformazione, memoria, configurazione del motore e tracciamento. Abilitare modalità strict e rendere espliciti gli esiti, ad esempio risposta completa, redirect, richiesta `NEWKEY`, mancata corrispondenza e fallback `NONE`. Mantenere UI e motore separati così che i test del core non richiedano DOM o browser automation.

### 3. Portare i meccanismi, non il parser storico

Implementare tokenizzazione e normalizzazione deterministiche, delimitazione delle clausole, costruzione dello stack, matching delle decomposizioni e ricomposizione. La priorità deve seguire la regola incrementale «solo i nuovi massimi davanti»: non sostituirla con un sort discendente globale. Implementare redirect ordinari e `PRE`, `NEWKEY`, ciclo delle risposte per trasformazione, hash storico ove previsto, rotazione `LIMIT` e memoria FIFO come meccanismi isolati e testabili.

Non portare il tokenizer S-expression o il parser di script nel bundle/runtime salvo nuova decisione esplicita: il piano usa definizioni di copione TypeScript tipizzate, quindi il browser non deve caricare o interpretare script arbitrari. Documentare separatamente quali forme del formato storico non sono importabili.

Rendere deliberate le differenze di policy: fallback `NONMATCH` rispetto a `NONE`, esaurimento di `NEWKEY`, delimitatori, memoria e limite di trasformazioni. La modalità storica non deve aggiungere casualità; se è prevista una modalità variata, limitare il PRNG alla selezione di alternative manualmente definite.

### 4. Costruire le regole italiane conservative

Organizzare lessico, copione, tokenizer/normalizzatore e trasformazioni italiane in moduli dedicati. Trattare pronomi, possessivi, clitici, elisioni e accordi mediante tabelle/regole tipizzate; quando una trasformazione è ambigua, usare un fallback neutro invece di inferire il genere. Tenere eventuali avvisi di safety fuori dal motore storico e dichiararli come comportamento aggiunto.

### 5. Realizzare l'interfaccia browser

Usare Vite per la build statica, Tailwind per gli stili e DOM nativo per la console conversazionale. Conservare tracce e controlli solo se coerenti con il prodotto nuovo; nessun servizio remoto è necessario. L'I/O ASR 33 e le interfacce seriali native restano fuori ambito. Verificare che build e asset funzionino da un sottopercorso e che l'app non faccia richieste di rete applicative.

### 6. Ricostruire la verifica in TypeScript

Scrivere test unitari del core per normalizzazione, delimitatori, stack incrementale (incluso `1, 4, 2`), classi/catture, wildcard, ricomposizioni, rotazione, redirect, `NEWKEY`, fallback e memoria FIFO. Aggiungere test del parser solo per dati TypeScript, validazione del copione italiano, conversazioni golden e test UI essenziali. Tutti i test devono usare toolchain JavaScript/TypeScript del progetto, senza compilare o lanciare il vecchio C++.

La baseline storica dispone di test integrati per matching, ricomposizione, hash, parser, memoria, conversazioni archivistiche e macchine di Turing. Prima dell'ultimo chiarimento dell'utente, la compilazione C++ aveva riportato zero errori di test stampati e tutte le 15 risposte CACM attese; questa evidenza documenta il punto di partenza, non sostituisce test TypeScript e non va riprodotta introducendo C++ nella pipeline.

### 7. Chiudere la migrazione e i riferimenti

Allineare la documentazione d'uso alla build Vite e rimuovere istruzioni operative che presuppongono un compilatore C++. Mantenere i rimandi al codice precedente esclusivamente tramite commit e URL upstream fissati; non collegare i documenti a percorsi locali di sorgenti C++ rimossi. Distinguere chiaramente copioni e trascrizioni storici dal bundle e dai dati effettivamente usati dall'applicazione.

## Criteri di completamento

- Installazione, typecheck, test e build usano solo tool JavaScript/TypeScript dichiarati dal progetto.
- Il risultato è statico e non include backend, NLP, richieste a servizi remoti o adattatori seriali nativi.
- Test mirati rendono osservabili stack, matching, ricomposizioni, redirect, memoria e fallback.
- La documentazione separa fedeltà meccanica verificata, differenze del porting web e reinterpretazione linguistica italiana.
- Ogni riferimento al vecchio codice resta puntato al commit `30eb61bc1c36a439b344276110e4942a42b0e7a4`, senza promettere sorgenti C++ nel repository corrente.
