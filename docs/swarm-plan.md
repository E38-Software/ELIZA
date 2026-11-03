# Piano dei 20 workstream

L'applicazione finale è un sito statico: nessun server applicativo, nessuna compilazione C++ e nessuna dipendenza C++ per sviluppo, test o runtime. I sorgenti C++ originali sono recuperabili nel commit Git `30eb61bc1c36a439b344276110e4942a42b0e7a4` e vengono rimossi dal progetto corrente su richiesta esplicita.

La piattaforma mette a disposizione sei sottoagenti simultanei; i venti workstream sono quindi organizzati a turni. Ogni file ha un solo responsabile alla volta. Il coordinatore integra e verifica ogni contributo, senza eliminare modifiche altrui.

| # | Workstream | Responsabilità / proprietà |
|---|---|---|
| 1 | Inventario completo | `docs/codebase-analysis.md` |
| 2 | Analisi motore e ciclo | coordinatore, `src/core/ElizaEngine.ts` |
| 3 | Confronto web originale | `docs/architecture.md` |
| 4 | Parser e copioni storici | `docs/migration-plan.md`; nessun parser richiesto nel runtime |
| 5 | Keyword, decomposizioni e ricomposizioni | coordinatore, matcher in `src/core/` |
| 6 | Memoria e rotazione | coordinatore, `src/core/MemoryStore.ts`; `docs/stochastic-behaviour.md` |
| 7 | Fonti e licenze | `docs/historical-baseline.md`, `docs/sources-and-licenses.md` |
| 8 | Architettura e contratti | coordinatore, `src/core/types.ts` |
| 9 | Tokenizzazione e normalizzazione | `src/language/it/tokenizer.ts`, `normalizer.ts` e relativi test |
| 10 | Pronomi e possessivi | moduli linguistici e relativi test |
| 11 | Verbi e accordi | moduli linguistici e relativi test |
| 12 | Clitici ed elisioni | moduli linguistici e relativi test |
| 13 | Keyword italiane e copione | `src/language/it/keywords.ts` e dati TypeScript correlati |
| 14 | PRNG e selezione | coordinatore, `src/core/SeededRandom.ts` e selezione |
| 15 | Terminale e Tailwind | `index.html`, `src/ui/`, `src/styles/`, `src/main.ts` |
| 16 | Accessibilità e responsive | responsabile UI, con verifica indipendente |
| 17 | Privacy e safety override | `src/safety/` e relativi test |
| 18 | Test unitari, integrazione e golden | `tests/`, con ownership per file esplicita |
| 19 | Build, CI e deployment | manifesti, configurazioni, workflow e `docs/deployment.md` |
| 20 | Revisione indipendente | audit in sola lettura, regressioni, licenze e criteri |

## Ordine e dipendenze

1. Analisi della repository originaria, confronto con il sorgente e documentazione della baseline prima della riscrittura.
2. Contratti TypeScript, configurazione di build e test senza C++.
3. Implementazione separata di motore, lingua italiana, script locale e sicurezza.
4. Integrazione dell'interfaccia statica accessibile e dei comandi locali.
5. Test mirati, conversazioni golden, typecheck, lint, build, Playwright, privacy/offline, revisione indipendente e aggiornamento della documentazione.

## Rischi e mitigazioni

- **Fedeltà:** `historical` riproduce meccanismi verificati, non pretende equivalenza linguistica con DOCTOR in inglese. Le differenze sono documentate.
- **Ambiguità italiana:** trasformazioni esplicite conservative e risposte neutre; nessuna assegnazione automatica del genere.
- **Fonti e licenze:** niente corpus, dizionari o script di terzi incorporati nella nuova build senza verifica; i materiali storici restano distinti.
- **Privacy:** nessuna rete applicativa, nessun salvataggio automatico, nessun modello o libreria NLP.
- **Distribuzione:** asset locali e base relativa per funzionare anche sotto un sottopercorso.
