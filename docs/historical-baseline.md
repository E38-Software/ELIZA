# Baseline storica

## Ambito

Questa nota distingue i meccanismi osservati nell'implementazione C++ fissata al commit upstream [30eb61bc1c36a439b344276110e4942a42b0e7a4](https://github.com/anthay/ELIZA/tree/30eb61bc1c36a439b344276110e4942a42b0e7a4) dal motore TypeScript italiano attuale. Il secondo reinterpreta alcune idee, non traduce il copione DOCTOR né dichiara equivalenza completa. I sorgenti C++ sono stati rimossi dal checkout corrente e restano consultabili nello storico al commit indicato; la pagina storica [src/eliza.html](../src/eliza.html) è presente ma non è l'entry point della nuova applicazione.

## Contesto

L'articolo di Joseph Weizenbaum su _Communications of the ACM_ è del gennaio 1966. La listing d'archivio MIT discussa nella documentazione storica è attribuita al 1965 e reca la data `030665`; non va considerata identica alla versione descritta nel 1966. Il riferimento estetico PDP-9 non prova che l'ELIZA storica girasse su quell'hardware: l'articolo descrive MAD-SLIP/SLIP su IBM 7094.

## Meccanismi nel C++ upstream

- `LIMIT` parte da 1 e avanza prima della risposta: 2, 3, 4, 1.
- La memoria è una FIFO. Il codice accoda con `memories_.push_back(new_memory)` e richiama rimuovendo dal fronte (`pop_front`); non impone una capacità massima.
- La regola MEMORY contiene quattro template di ricomposizione. L'hash Hollerith mid-square sceglie quale usare; quattro è il numero di template/esiti, **non** il limite delle voci FIFO.
- L'hash considera l'ultima cella allineata di sei caratteri dell'input e completa a destra con spazi. `INVENTED` termina con la cella `ED    `, non con le ultime sei lettere `VENTED`.
- In `apply_transformation`, l'iteratore parte da `trans_.begin()` e avanza fino alla prima decomposizione compatibile. Le decomposizioni non ruotano e non hanno un contatore di selezione.
- Ogni `transform` conserva il proprio `next_reassembly_rule`; solo l'indice delle ricomposizioni avanza ciclicamente, indipendentemente per quella decomposizione.

Quindi, a input invariato, viene provata prima la stessa decomposizione compatibile; può cambiare la ricomposizione associata a quella trasformazione. Una decomposizione successiva viene scelta soltanto se quelle precedenti non corrispondono.

## Confronto col core TypeScript

Il core attuale prova `rule.decompositions` nell'ordine dell'array e si ferma al primo pattern compatibile. `ResponseSelector` conserva gli indici di ricomposizione per chiave, senza indice per la decomposizione. Il motore italiano implementa inoltre tre modalità e una memoria locale; i dettagli sono in [stochastic-behaviour.md](./stochastic-behaviour.md).

La conversazione pubblicata nel CACM è un riferimento per confronti storici, non prova che il copione italiano produca gli stessi testi. Questa nota non attesta l'esito di test o build della baseline o del runtime nuovo.
