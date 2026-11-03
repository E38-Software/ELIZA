# Progettazione linguistica italiana

## Implementazione e ambito

Il runtime italiano è composto da [normalizer.ts](../src/language/it/normalizer.ts), [tokenizer.ts](../src/language/it/tokenizer.ts), tabelle di riflessione in `pronouns.ts`, `possessives.ts`, `verbs.ts`, `clitics.ts` ed `elisions.ts`, e dati locali di keyword e fallback in `keywords.ts` e `fallbacks.ts`. Usa TypeScript e regole esplicite: niente NLP, modelli linguistici, dizionari remoti o DOM.

Le risposte italiane si rivolgono all'utente con il **tu**. Le tabelle sono limitate e non costituiscono comprensione o copertura generale dell'italiano.

## Normalizzazione e token

`normalizeInput` applica NFC, minuscole italiane (`it-IT`), una seconda NFC e converte U+2018, U+2019, U+02BC e U+FF07 in apostrofo ASCII per il confronto. Non rimuove gli accenti.

`tokenize` percorre l'input originale e restituisce token contigui di tipo `word`, `number`, `punctuation`, `whitespace` o `symbol`. Le parole possono contenere segni combinanti e apostrofi interni quando seguono una lettera; spazi Unicode e sequenze numeriche vengono raggruppati; sequenze consecutive di punti sono un token di punteggiatura, così come il carattere ellissi U+2026. Ogni token conserva `original`, forma `normalized` e offset UTF-16 `[start, end)` sulla stringa sorgente. Concatenando gli originali si ricostruisce l'input anche quando NFC cambia la lunghezza della forma normalizzata.

## Riflessioni esatte

`reflectFragment` esamina una sola volta i token e confronta forme normalizzate intere. Non concatena trasformazioni; casing, apostrofo originale, spazi e punteggiatura sono mantenuti.

- **Pronomi:** `io`↔`tu`, `me`↔`te`, `mi`↔`ti`, `noi`↔`voi`.
- **Possessivi:** `mio/mia/miei/mie`↔`tuo/tua/tuoi/tue`; `nostro/nostra/nostri/nostre`↔`vostro/vostra/vostri/vostre`. L'accordo grammaticale presente nella desinenza è conservato. `suo/sua/suoi/sue`, `loro`, `proprio` e `altrui` non sono riflessi.
- **Verbi:** sono tabellate forme di presente, imperfetto, futuro semplice e condizionale presente, nelle coppie di prima/seconda persona singolare e plurale, per `essere`, `avere`, `potere`, `volere`, `dovere`, `pensare`, `credere`, `sentire`, `sapere`, `vedere`, `capire`, `ricordare`, `desiderare`, `temere`, `sperare`, `sembrare`, `parlare` e `riuscire`. Non si deriva morfologia per suffisso. Nel passato composto può cambiare l'ausiliare tabellato; il participio resta invariato. Il passato remoto non è incluso.
- **Clitici all'infinito:** `sentirmi`↔`sentirti`, `vedermi`↔`vederti`, `capirmi`↔`capirti`. `parlarne` resta invariato; `pensarci` è un'eccezione ambigua.
- **Elisioni:** `l'ho`↔`l'hai`; `c'è`, `com'è` e `cos'è` restano stabili.

## Negazione, fallback e sicurezza

Le keyword locali includono un gruppo per negazioni (`non`, `no`, `mai`, `niente`, `nessuno/a`, `senza`) e una regola dedicata a forme con `mai`. Non c'è però un parser di polarità né un calcolo dello scope: `non` non viene alterato dalla riflessione, ma un verbo tabellato vicino può essere riflesso. Non inferire da questo una preservazione generale del significato.

Le risposte e i fallback italiani sono frasi statiche locali. Il core supporta regole di risposta con catture riflesse e `unsafeFallback`, ma le keyword italiane attuali non dichiarano `reflect` nelle ricomposizioni. La riflessione è collegata al percorso della memoria per la scelta dell'hash; se lì una forma è insicura, viene usata la clausola originale. La logica generica di reassembly usa il fallback sicuro configurato per una riflessione insicura, altrimenti procede al no-match.

Gli imperativi ambigui `dimmi`, `parlami`, `spiegami`, `raccontami`, i token autonomi `ci` e `vi`, e `pensarci` sono lasciati invariati, registrati in `exceptions` e impostano `safe=false`. Anche `lo/la/li/le/gli/ne` e `parlarne` restano invariati, ma non sono eccezioni unsafe. `safe=true` significa solo che non è stata rilevata una di queste eccezioni esplicite; non certifica correttezza semantica.

Un percorso safety separato usa pattern regex locali su frasi di pericolo immediato e, quando scatta, salta il motore e mostra un messaggio statico. Non è NLP, non diagnostica e non fornisce copertura generale del rischio.

## Limiti e verifiche

Il matching non disambigua omografi, non interpreta referenti o contesto e non tratta sequenze multi-parola come un'unica riflessione. Le forme non tabellate restano invariate; il genere dell'utente non viene dedotto e i participi non vengono accordati automaticamente.

Sono presenti test Vitest per tokenizer, riflessioni e conversazioni; non sono stati eseguiti durante questo aggiornamento documentale, quindi non se ne dichiara l'esito.
