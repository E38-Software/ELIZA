# Registro delle decisioni

## 2026-11-03

1. **Runtime locale e statico.** L'app conversazionale gira nel browser; non introduce backend, API, servizi linguistici, telemetria o persistenza automatica. È disponibile un'esportazione esplicita locale. Dopo il caricamento delle risorse può continuare offline nella scheda; senza service worker o cache applicativa automatica, l'avvio a freddo offline non è garantito.
2. **C++ nello storico.** I sorgenti C++ sono stati rimossi dal checkout corrente; la baseline è consultabile al commit [30eb61bc1c36a439b344276110e4942a42b0e7a4](https://github.com/anthay/ELIZA/tree/30eb61bc1c36a439b344276110e4942a42b0e7a4). La pagina storica [src/eliza.html](../src/eliza.html) è presente ma non è l'entry point TypeScript/Vite.
3. **Stack implementato.** TypeScript strict, DOM nativo, Vite e Tailwind; il core conversazionale non dipende dal DOM.
4. **Regole italiane esplicite.** Tokenizer Unicode, tabelle limitate di riflessione, keyword e fallback locali; l'app usa il tu. Nessuna promessa di copertura grammaticale generale o inferenza di genere.
5. **Fallback e safety separati.** Fallback conversazionali e percorso regex safety sono locali e distinti; il safety non è una diagnosi né un classificatore generale.
6. **Modalità core.** `historical`, `deterministic` e `varied` sono implementate. La modalità varied usa Mulberry32 seeded; historical e deterministic non usano RNG per le selezioni ordinarie.
7. **Baseline di decomposizione corretta.** Il C++ storico e il core TypeScript provano in ordine e usano la prima decomposizione compatibile. Nessun contatore ruota le decomposizioni; la rotazione riguarda gli indici di ricomposizione per decomposizione.
8. **FIFO senza cap a quattro.** La memoria storica accoda e rimuove dal fronte senza limite di capacità. Quattro è il numero di template MEMORY e degli esiti hash, non la capacità della coda.
9. **Interfaccia terminale.** La UI conversazionale offre fosfori verdi o ambra, con comandi locali e sezioni «Traccia locale» e «Impostazioni» ripiegabili. Modalità, seed e contatore non occupano la vista principale.
10. **Nessun esito di test implicito.** La repository contiene test e una workflow CI, ma la documentazione non dichiara risultati senza un'esecuzione verificata.
11. **Hardening del tooling npm.** ESLint 10 e `type: module` allineano la toolchain ESM ai requisiti Node dichiarati. L'override top-level `minimatch: ^11.0.4` mitiga temporaneamente un advisory DoS nel grafo dev-only; rimuoverlo quando gli upstream dichiarano range sicuri compatibili e rigenerare/verificare il lockfile. Il team riporta audit senza vulnerabilità, non verificato indipendentemente in questa sessione.
