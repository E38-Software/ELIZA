# Fonti e licenze

## Materiali storici

- Joseph Weizenbaum, “ELIZA—A Computer Program for the Study of Natural Language Communication Between Man and Machine”, _Communications of the ACM_, 9(1), gennaio 1966, pp. 36–45. [Copia dell'articolo](https://web.stanford.edu/class/linguist238/p36-weizenabaum.pdf).
- Implementazione di Anthony Hay fissata al commit [30eb61bc1c36a439b344276110e4942a42b0e7a4](https://github.com/anthay/ELIZA/tree/30eb61bc1c36a439b344276110e4942a42b0e7a4), usata come riferimento storico e non come dipendenza runtime.
- Treccani, [“Elisione”](https://www.treccani.it/enciclopedia/elisione/), come riferimento ortografico per la progettazione delle regole. L'app non interroga il sito né incorpora un suo dizionario.

## Codice e contenuti

Il repository contiene una licenza [CC0 1.0 Universal](../LICENSE). La concessione vale nei limiti dei diritti effettivamente detenuti da chi l'ha applicata; non estende automaticamente la licenza a opere di terzi.

La pagina storica [src/eliza.html](../src/eliza.html) è presente nel checkout, ma non è l'entry point dell'app nuova; incorpora la trascrizione del copione DOCTOR pubblicato nel CACM e riporta l'attribuzione di copyright all'Association for Computing Machinery. I sorgenti C++ sono stati rimossi dal checkout corrente e restano consultabili nello storico al commit indicato fra le fonti. Anche articolo, listing MIT, copioni archivistici, trascrizioni e conversazioni hanno provenienza e condizioni da valutare separatamente. La disponibilità della pagina e dei materiali nello storico non equivale a una dichiarazione che tutto il materiale storico sia riutilizzabile senza limiti.

Il runtime italiano usa tabelle di keyword, risposte, fallback e riflessioni locali; non carica dataset o corpora remoti e non incorpora il copione DOCTOR nel suo entry point. Il manifest elenca le dipendenze di toolchain come dipendenze di sviluppo; le loro licenze vanno considerate separatamente per gli usi di distribuzione pertinenti.

Il logo e38 è stato fornito da e38 srl per identificare gli autori di questa applicazione. Il suo utilizzo nel progetto non concede diritti sul marchio.

## Rete e attribuzione

La UI a fosfori verdi o ambra offre comandi e controlli locali ripiegabili; non vengono inviate richieste a servizi linguistici o alle fonti citate. Dopo il caricamento della pagina e delle risorse, la conversazione può proseguire offline nella scheda; senza service worker o cache applicativa automatica non è garantito l'avvio a freddo offline. La UI consente un'esportazione esplicita locale della sessione; non salva automaticamente i dati in storage browser.

Queste note documentano provenienza e limiti, non costituiscono parere legale. La licenza del repository non implica diritti sul marchio ELIZA o sui materiali storici di terzi.
