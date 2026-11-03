# Comportamento deterministico e variazione

Il core implementa tre modalità: `historical` (predefinita per `ElizaEngine`), `deterministic` e `varied`. Non sono tre ricostruzioni storiche equivalenti: `historical` riprende alcuni meccanismi osservabili, mentre tutte usano il copione italiano locale.

## Strategie di selezione

- **Historical:** le risposte con alternative ruotano in modo deterministico per chiave; la memoria seleziona uno dei suoi quattro template con `historicalHash`. Gli input ripetuti non attivano il fallback di ripetizione.
- **Deterministic:** usa la stessa rotazione per chiave e lo stesso hash della modalità historical. In più, un input non vuoto uguale al precedente dopo normalizzazione, trim e collasso degli spazi usa il fallback di ripetizione.
- **Varied:** usa `SeededRandom` (Mulberry32) per selezionare alternative di ricomposizione, fallback e template di memoria. Un input ripetuto attiva il relativo fallback. A parità di seed, input e stato la sequenza è riproducibile; non è casualità crittografica.

Il seed del core predefinito è 1966; la UI attuale avvia il motore con seed 0. I seed ammessi sono interi unsigned a 32 bit. Cambiare modalità o seed reimposta stato e selettori. In modalità varied una scelta con una sola alternativa non consuma un draw. Le estrazioni effettuate sono registrate nel trace.

In historical e deterministic gli indici di ricomposizione avanzano ciclicamente e indipendentemente per chiave di keyword/decomposizione. Le risposte fallback ordinarie usano a loro volta chiavi di selezione; la risposta di no-match, invece, è indicizzata da `LIMIT` fuori dalla modalità varied.

## `LIMIT` e memoria

`LIMIT` parte da 1 e avanza prima di ogni risposta secondo 2 → 3 → 4 → 1. Se non c'è una keyword e il valore aggiornato è 4, il motore può richiamare la voce più vecchia della FIFO; altrimenti usa il fallback ordinario. La coda non ha un limite di quattro elementi: `MemoryStore` accoda e rimuove dal fronte senza imporre una capacità massima.

Quattro è il numero di template della regola di memoria italiana e il numero di esiti dell'hash a 2 bit, non la capacità della coda. In historical e deterministic il motore applica `historicalHash` all'ultima parola della clausola; in varied sceglie il template col PRNG seeded. Se la riflessione della clausola è insicura, l'hash usa la clausola originale. Il testo memorizzato resta la clausola originale.

La memoria può essere creata da una keyword con `memoryPolicy`; non viene richiamata se una keyword è stata trovata, né quando `LIMIT` non è 4. Il reset del motore la svuota.

## Decomposizione storica: selezione corretta

Nel sorgente upstream fissato, `apply_transformation` percorre `trans_` dall'inizio e sceglie la prima decomposizione compatibile con l'input. **Non esiste un indice o una rotazione delle decomposizioni.** Ogni elemento `transform` possiede invece `next_reassembly_rule`: è l'indice della ricomposizione e avanza ciclicamente per quella decomposizione.

Anche il core TypeScript prova le decomposizioni nell'ordine dichiarato e usa la prima corrispondenza. Le rotazioni implementate riguardano le ricomposizioni, con selettori separati per chiave di decomposizione; non c'è una rotazione dei pattern di decomposizione. La modalità `historical` non cambia questa regola.

## Hash MEMORY storico

L'hash Hollerith mid-square è deterministico, non un RNG. Usa il blocco allineato finale di sei caratteri dell'ultima cella, completato con spazi a destra, e nel motore restituisce un indice a 2 bit. Per `INVENTED`, la cella finale è `ED    `, non la sottostringa `VENTED`.

## Ambito delle affermazioni

Le differenze e i dettagli di `LIMIT`, FIFO e selezione delle decomposizioni della baseline sono riportati anche in [historical-baseline.md](./historical-baseline.md). I test del core e d'integrazione sono presenti, ma non sono stati eseguiti durante questo aggiornamento: non se ne dichiara l'esito.
