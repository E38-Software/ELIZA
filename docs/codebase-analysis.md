# Analisi della codebase e baseline storica

## Ambito e fonte

Questa analisi descrive il repository storico al commit [30eb61bc1c36a439b344276110e4942a42b0e7a4](https://github.com/anthay/ELIZA/tree/30eb61bc1c36a439b344276110e4942a42b0e7a4) e ne separa il comportamento dal runtime TypeScript presente. I permalink upstream identificano lo snapshot, non dipendenze di build o runtime:

- [eliza.cpp](https://github.com/anthay/ELIZA/blob/30eb61bc1c36a439b344276110e4942a42b0e7a4/src/eliza.cpp)
- [eliza.html](https://github.com/anthay/ELIZA/blob/30eb61bc1c36a439b344276110e4942a42b0e7a4/src/eliza.html)
- [serial I/O POSIX](https://github.com/anthay/ELIZA/blob/30eb61bc1c36a439b344276110e4942a42b0e7a4/src/posix_serial_io.cpp) e [Windows](https://github.com/anthay/ELIZA/blob/30eb61bc1c36a439b344276110e4942a42b0e7a4/src/win_serial_io.cpp)

Il runtime attuale entra da `index.html` e `src/main.ts`, usa TypeScript strict, Vite e Tailwind, e non richiede backend o compilazione C++. I sorgenti C++ sono stati rimossi dal checkout corrente e restano consultabili nello storico al commit indicato. La pagina storica [src/eliza.html](../src/eliza.html) è presente, incorpora JavaScript e il copione DOCTOR, ma non è l'entry point dell'app italiana.

La UI attiva è un terminale conversazionale a fosfori verdi o ambra con comandi e controlli locali ripiegabili. Dopo il caricamento delle risorse la conversazione può continuare offline nella scheda, ma non è garantito l'avvio a freddo offline: mancano service worker e cache applicativa automatica.

## Parser e copioni storici

Il tokenizer storico legge S-expression: spazi e newline separano token, `;` avvia un commento, parentesi e `=` sono token autonomi, le cifre formano interi e i simboli sono normalizzati in maiuscolo. Il parser gestisce messaggio iniziale, eventuale `START`, regole keyword, una regola `MEMORY` e `NONE`; valida unicità e riferimenti. Le decomposizioni supportano parole letterali, `0` come wildcard variabile, interi positivi come catture a lunghezza fissa, `(* A B)` come insieme e `(/ TAG)` come classe DLIST. Le catture di ricomposizione sono indicizzate da 1.

I copioni e i materiali d'archivio elencati in [scripts/scripts.md](../scripts/scripts.md) sono riferimenti storici; il runtime TypeScript non carica copioni S-expression né file arbitrari.

## Ciclo storico

1. Il motore normalizza il testo e avanza `LIMIT` ciclicamente da 1 a 4.
2. Scansiona clausole e keyword costruendo uno stack secondo la precedenza, non con un ordinamento globale.
3. Per la keyword corrente prova le decomposizioni nell'ordine del copione e seleziona la prima compatibile.
4. Applica la ricomposizione associata, redirect o `NEWKEY`; se non produce una risposta usa il percorso `NONE` o quello `NONMATCH` previsto dalla configurazione.
5. Richiama memoria solo senza keyword e quando `LIMIT` è nello stato previsto.

### Decomposizioni e ricomposizioni

In `apply_transformation`, l'iteratore inizia da `trans_.begin()` e avanza finché trova la prima decomposizione compatibile. Non esiste un contatore di rotazione delle decomposizioni. Ogni elemento `transform` possiede il proprio `next_reassembly_rule`, che ruota soltanto le ricomposizioni associate a quell'elemento. Una decomposizione più avanti nell'array viene usata solo se quelle precedenti non corrispondono.

### Memoria: coda e template sono quantità diverse

La memoria storica accoda ogni nuovo ricordo con `memories_.push_back(new_memory)` e richiama rimuovendo la voce più vecchia dal fronte. Non c'è un limite di quattro ricordi né un'espulsione per capacità.

Quattro è il numero fisso di trasformazioni/template della regola MEMORY. Un hash deterministico di tipo Hollerith mid-square restituisce un indice per scegliere uno dei quattro template. Non confondere gli esiti dell'hash o i template con la dimensione della FIFO. L'hash usa l'ultima cella allineata di sei caratteri, riempita a destra: per `INVENTED` la cella finale è `ED    `.

## Stack, fallback e test storici

Lo stack non è ordinato globalmente per priorità: un nuovo massimo osservato viene inserito in testa e aggiorna la soglia; gli altri match sono accodati. I pareggi non spostano elementi. Il ciclo `LIMIT` seleziona i quattro messaggi predefiniti di no-match; `NONE` è una regola separata, non una keyword input.

Lo snapshot incorpora test nel sorgente C++ e la pagina web contiene `console.assert` diagnostici. Questo documento non riporta un esito di esecuzione dei test storici né del runtime nuovo.

## Materiali e serial I/O

La pagina upstream è un HTML autonomo con JavaScript/CSS inline, DOCTOR incorporato, file picker, comandi e trace. Il C++ ha inoltre adattatori seriali POSIX e Windows separati dal motore; la documentazione è in [doc/serial_io.md](../doc/serial_io.md). Questi componenti storici non sono servizi del runtime browser nuovo e non sono invocati dall'app italiana.
