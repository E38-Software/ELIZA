export interface GlossaryEntry {
  readonly term: string;
  readonly definition: string;
}

interface GlossaryRule extends GlossaryEntry {
  /** Riconosce il termine (o la sua notazione) nei testi mostrati all'utente. */
  readonly mentions: RegExp;
}

// L'ordine segue il percorso di una risposta, così ogni glossario si legge dall'alto in basso.
const rules: readonly GlossaryRule[] = [
  {
    term: 'Copione (script)',
    mentions: /copione|\bscript\b/iu,
    definition:
      'L’insieme di regole scritte a mano che guida ELIZA: parole chiave con la loro priorità, schemi di frase, risposte e frasi di riserva. Il motore è generico e si limita ad applicare il copione: cambiando copione cambia tutto il comportamento.',
  },
  {
    term: 'Identificatori',
    mentions: /\bit-[a-z]/u,
    definition:
      'Nomi interni delle regole del copione, utili per ritrovarle nei dati e nel codice. «it-famiglia» è una parola chiave; «it-famiglia-d1» il suo primo schema (d sta per decomposizione); «it-famiglia-d1-r2» la seconda risposta di quello schema (r sta per ricomposizione); «it-fallback-none:0» la prima frase di un elenco di risposte generiche, numerate da 0.',
  },
  {
    term: 'Token',
    mentions: /\btoken\b/iu,
    definition:
      'L’unità minima in cui il testo viene diviso prima del confronto con le regole: una parola, un numero, un segno di punteggiatura, un simbolo (per esempio un’emoji) oppure una sequenza di spazi. Le regole confrontano token interi, non singole lettere né significati.',
  },
  {
    term: 'Normalizzazione',
    mentions: /normalizz/iu,
    definition:
      'Trasformazione che rende identiche scritture diverse dello stesso testo, così il confronto con le regole non dipende da come hai digitato. Qui comprende tre operazioni: forma Unicode NFC, conversione in minuscolo e uniformazione degli apostrofi.',
  },
  {
    term: 'Unicode e categorie dei caratteri',
    mentions: /unicode/iu,
    definition:
      'Unicode è lo standard internazionale che assegna un numero, detto punto di codice e scritto per esempio U+00E8, a ogni carattere di ogni sistema di scrittura. Classifica inoltre ogni carattere in categorie: lettera, segno diacritico (un accento che si combina con la lettera precedente), cifra, punteggiatura, simbolo, spazio. Il tokenizzatore usa queste categorie per decidere dove inizia e finisce un token, quindi funziona con qualsiasi lettera accentata o alfabeto.',
  },
  {
    term: 'NFC (Normalization Form C)',
    mentions: /\bNFC\b/u,
    definition:
      'Una delle forme di normalizzazione definite da Unicode. La stessa lettera accentata può essere codificata come un solo carattere («è», U+00E8) oppure come lettera seguita da un accento combinante («e» + U+0300). A schermo sono identiche, ma per il computer sono sequenze diverse e un confronto diretto fallirebbe. NFC le converte tutte nella forma composta, a un solo carattere.',
  },
  {
    term: 'Minuscole con regole italiane (it-IT)',
    mentions: /it-IT/u,
    definition:
      'Il testo viene convertito in minuscolo usando le regole della lingua italiana; it-IT è il codice standard che indica lingua italiana e paese Italia. «PERCHÉ» diventa «perché», così «Madre» e «madre» vengono riconosciute dalla stessa regola.',
  },
  {
    term: 'Apostrofi tipografici',
    mentions: /apostrof/iu,
    definition:
      'Tastiere e correttori automatici producono apostrofi diversi (’ ‘ ʼ ＇). Vengono tutti sostituiti con l’apostrofo semplice della tastiera, così «l’amico» scritto in modi diversi diventa sempre lo stesso testo.',
  },
  {
    term: 'Tokenizzatore',
    mentions: /tokenizz/iu,
    definition:
      'Il componente che legge il testo un carattere alla volta e lo divide in token. Lettere e accenti consecutivi formano una parola, e un apostrofo seguito da una lettera la prolunga, come in «dell’amico». Cifre consecutive formano un numero. Ogni segno di punteggiatura è un token a sé, tranne i puntini consecutivi che restano insieme. Emoji e altri simboli diventano token di tipo simbolo. Più spazi consecutivi formano un solo token di spazio.',
  },
  {
    term: 'UTF-16',
    mentions: /UTF-16/u,
    definition:
      'Il formato con cui il browser conserva il testo in memoria: ogni carattere occupa una o due unità da 16 bit (due per molte emoji). Il limite di 4096 unità corrisponde quindi a poco meno di 4096 caratteri.',
  },
  {
    term: 'Clausola',
    mentions: /clausol/iu,
    definition:
      'Uno spezzone del messaggio delimitato da virgola, punto, puntini di sospensione o dalla parola «ma»; punto interrogativo, punto esclamativo e punto e virgola non dividono. ELIZA cerca le parole chiave clausola per clausola e lavora solo sulla prima che ne contiene almeno una: il resto del messaggio viene ignorato.',
  },
  {
    term: 'Parola chiave (keyword) e tema',
    mentions: /parol[ae] chiave|\bkeyword|\btem[ai]\b/iu,
    definition:
      'Una parola chiave è una parola o un’espressione di più parole, come «mi sento», che il copione sa riconoscere. Ognuna appartiene a un tema, cioè a un gruppo di regole: «madre», «padre» e «famiglia» portano tutte al tema «famiglia». Nello stesso messaggio possono comparire più parole chiave, e una stessa parola può attivarne più di una.',
  },
  {
    term: 'Priorità (o precedenza)',
    mentions: /priorit|precedenz/iu,
    definition:
      'Numero assegnato a mano a ogni parola chiave nel copione. Più è alto, prima la parola chiave viene presa in considerazione. Misura solo l’ordine di tentativo, non la rilevanza dell’argomento né quanto ELIZA «capisca».',
  },
  {
    term: 'Stack delle parole chiave (unshift e push)',
    mentions: /\bstack\b|unshift|\bpush\b/iu,
    definition:
      'L’elenco ordinato delle parole chiave trovate, da cui il motore estrae sempre la prima voce, detta testa. Si costruisce leggendo la clausola da sinistra a destra: una parola chiave con priorità più alta di tutte quelle incontrate finora viene inserita in testa (operazione chiamata unshift); le altre vengono aggiunte in fondo (operazione chiamata push). Per questo l’ordine finale non è un ordinamento completo per priorità, ma dipende anche dalla posizione nella frase. Le voci mai estratte restano nello stack senza alcun effetto.',
  },
  {
    term: 'Posizione nel testo',
    mentions: /al carattere/iu,
    definition:
      'Indica dove inizia la parola chiave nel messaggio originale, contando i caratteri da 0: «al carattere 0» significa all’inizio del messaggio.',
  },
  {
    term: 'Schema, pattern o decomposizione',
    mentions: /schem[ai]|pattern|decomposizion|-d\d+\b/iu,
    definition:
      'Un modello di frase associato a una parola chiave, fatto di parti fisse e di spazi variabili. «Decomposizione» è il nome usato da Weizenbaum nel 1966, perché lo schema scompone la frase in pezzi riutilizzabili. Uno schema corrisponde solo se copre tutte le parole della clausola, dalla prima all’ultima. Nella notazione tecnica le parole semplici sono parti fisse (literal), (a | b) indica una scelta fra alternative (oneOf) e [nome: min–max parole] uno spazio variabile (wildcard). Gli schemi di una parola chiave si provano sempre nello stesso ordine e vince il primo che corrisponde.',
  },
  {
    term: 'literal',
    mentions: /\bliteral\b/u,
    definition:
      'Parte fissa di uno schema: in quel punto deve comparire esattamente quella parola, dopo la normalizzazione.',
  },
  {
    term: 'oneOf',
    mentions: /\boneOf\b|\([^()]*\|[^()]*\)/u,
    definition:
      'Parte fissa con alternative: in quel punto va bene una qualsiasi delle parole elencate tra parentesi e separate da «|».',
  },
  {
    term: 'wildcard',
    mentions: /wildcard|\[[^\]]+: [^\]]*parol[ae]\]/iu,
    definition:
      'Spazio variabile di uno schema: accetta da un minimo a un massimo di parole consecutive (anche nessuna, se il minimo è 0) e le cattura con il nome scritto prima dei due punti. Il motore prova prima la lunghezza minima e la allunga solo se il resto dello schema non si incastra.',
  },
  {
    term: 'Backtracking',
    mentions: /backtracking/iu,
    definition:
      'Ricerca per tentativi con ritorno indietro: quando una scelta, per esempio quante parole assegnare a uno spazio variabile, porta a un vicolo cieco, il motore torna al punto di scelta e prova l’opzione successiva. I tentativi già falliti vengono memorizzati per non ripeterli.',
  },
  {
    term: 'Cattura',
    mentions: /cattur/iu,
    definition:
      'Il pezzo di frase finito in uno spazio variabile dello schema, conservato con il nome dello spazio e con la scrittura originale, maiuscole comprese. Una risposta può reinserirlo al posto di un segnaposto.',
  },
  {
    term: 'redirectTo',
    mentions: /redirectTo/u,
    definition:
      'Tema di riserva dichiarato su una parola chiave: se nessuno dei suoi schemi corrisponde, la ricerca continua con le regole di quel tema invece di passare subito a una risposta generica.',
  },
  {
    term: 'Ricomposizione (reassembly)',
    mentions: /ricomposizion|reassembl|segnaposto|-r\d+\b/iu,
    definition:
      'Un modello di risposta scritto nel copione e legato a uno schema. Contiene segnaposto come {{stato}} che vengono sostituiti dalle catture: «Da quanto tempo ti senti {{stato}}?» con stato = «triste» diventa «Da quanto tempo ti senti triste?». Ogni schema ha una o più ricomposizioni alternative.',
  },
  {
    term: 'redirect e NEWKEY',
    mentions: /\bredirect\b|NEWKEY|rinvi/u,
    definition:
      'Due ricomposizioni speciali che non producono testo. Redirect (rinvio) rimanda a un altro tema: la sua parola chiave viene messa in testa allo stack e la ricerca riparte da lì. NEWKEY abbandona la parola chiave corrente e passa alla voce successiva dello stack.',
  },
  {
    term: 'Limite di 64 trasformazioni',
    mentions: /\b64\b/u,
    definition:
      'Per evitare cicli infiniti di rinvii fra temi, il motore si ferma dopo 64 passaggi e usa una risposta generica.',
  },
  {
    term: 'Rotazione',
    mentions: /rotazion|a turno/iu,
    definition:
      'Nelle modalità storica e deterministica ogni schema ha un proprio indice che parte da 0: a ogni uso si sceglie la ricomposizione in quella posizione e l’indice avanza di uno, ricominciando da 0 dopo l’ultima. Così le risposte si alternano in modo prevedibile e senza casualità.',
  },
  {
    term: 'Modalità storica, deterministica e variata',
    mentions: /modalità|\bstorica\b|deterministica|\bvariata\b/iu,
    definition:
      'Le tre strategie di scelta, impostabili nelle Impostazioni. Storica: rotazione delle risposte e hash Hollerith per i ricordi, come nell’ELIZA originale. Deterministica: le stesse scelte, ma un messaggio identico al precedente usa le risposte per le ripetizioni. Variata: le scelte fra alternative sono fatte da un generatore pseudo-casuale con seed.',
  },
  {
    term: 'PRNG, seed e stato (Mulberry32)',
    mentions: /PRNG|Mulberry|\bseed\b|estrazion|a caso/iu,
    definition:
      'PRNG significa generatore di numeri pseudo-casuali: una formula che produce una sequenza di numeri apparentemente casuali, ma sempre identica se si parte dallo stesso numero iniziale, il seed. Mulberry32 è il PRNG usato qui: conserva uno stato, un numero di 32 bit che cambia a ogni estrazione. Per scegliere fra n alternative scarta i pochi valori che favorirebbero alcune scelte (campionamento con rifiuto) e usa il resto della divisione per n. Stesso seed e stessi messaggi producono le stesse scelte.',
  },
  {
    term: 'Ricordo e template MEMORY',
    mentions: /MEMORY|[Rr]icord/u,
    definition:
      'Un ricordo è una frase preparata a partire da una tua frase precedente, per esempio «Tengo presente «La mia bicicletta è rossa». Su quale parte vuoi soffermarti?». Il copione offre quattro modelli, detti template MEMORY; ne viene scelto uno, completato con la clausola e messo da parte per un turno futuro. Non è la cronologia della conversazione.',
  },
  {
    term: 'memoryPolicy',
    mentions: /memoryPolicy/u,
    definition:
      'Proprietà di alcune parole chiave del copione, qui i possessivi come «mio» e «mia»: quando una di queste viene usata, oltre a rispondere il motore prepara e accoda anche un ricordo.',
  },
  {
    term: 'Coda FIFO (enqueue e dequeue)',
    mentions: /FIFO|enqueue|dequeue|\bcoda\b|accod/iu,
    definition:
      'FIFO significa «First In, First Out», il primo che entra è il primo che esce, come una fila allo sportello. Inserire in fondo si dice enqueue, estrarre dalla testa si dice dequeue. I ricordi stanno in una coda FIFO senza limite di dimensione, quindi viene sempre ripreso il ricordo più vecchio.',
  },
  {
    term: 'LIMIT',
    mentions: /LIMIT|\bmod\b|contatore/u,
    definition:
      'Contatore interno che avanza prima di ogni risposta seguendo il ciclo 1 → 2 → 3 → 4 → 1; all’avvio vale 1, quindi la prima risposta avviene con LIMIT = 2. Serve a due cose: un ricordo viene ripreso solo quando non c’è nessuna parola chiave e LIMIT vale 4; la risposta generica no-match viene scelta con la formula (LIMIT − 1) mod n, dove mod è il resto della divisione e n il numero di frasi disponibili.',
  },
  {
    term: 'Hash Hollerith',
    mentions: /\bhash\b|Hollerith/iu,
    definition:
      'Funzione ripresa dall’ELIZA originale per scegliere il template MEMORY senza casualità. Prende l’ultima parola della clausola, in maiuscolo e dopo la riflessione; ne considera l’ultimo blocco di sei caratteri, contando a gruppi di sei dall’inizio della parola, e lo completa con spazi. Converte ogni carattere nel codice a 6 bit delle schede perforate e dei computer IBM degli anni Sessanta (codice Hollerith), unisce i codici in un unico numero binario, lo eleva al quadrato e ne estrae 2 bit centrali (metodo «middle square»). Il risultato, da 0 a 3, indica uno dei quattro template. Stessa parola, stesso risultato.',
  },
  {
    term: 'Riflessione',
    mentions: /riflession|riflett|riflessi\b|\breflect\b/iu,
    definition:
      'Sostituzione grammaticale che cambia il punto di vista da chi scrive a chi risponde: «mio» → «tuo», «sono» → «sei». Usa tabelle di pronomi, possessivi e verbi, senza capire la frase; se una sostituzione è ambigua viene segnalata come non sicura. Nelle ricomposizioni, il campo reflect elenca le catture da riflettere prima di inserirle. Nel percorso della memoria la riflessione serve solo a calcolare l’hash: il ricordo conserva la frase originale.',
  },
  {
    term: 'Risposte generiche e percorsi di riserva (fallback)',
    mentions: /fallback|no-match|empty-input|\brepeat\b|riserva|generic|ripetut|prudente/iu,
    definition:
      'Frasi del copione usate quando il percorso normale non porta a una risposta: messaggio vuoto (empty-input), messaggio uguale al precedente (repeat), nessuna parola chiave utilizzabile (fallback generico), parola chiave senza schemi compatibili (no-match) oppure riformulazione non sicura (frase prudente di riserva). Non sono interpretazioni del messaggio, solo uscite di sicurezza.',
  },
  {
    term: 'LLM (Large Language Model)',
    mentions: /\bLLM\b/u,
    definition:
      'Modello linguistico di grandi dimensioni, come quelli dietro ai chatbot moderni: una rete neurale addestrata su enormi quantità di testo che genera la risposta un token alla volta, scegliendo ogni volta fra tutte le continuazioni possibili in base a probabilità apprese. Non ha un copione di frasi scritte a mano.',
  },
  {
    term: 'Token di un LLM',
    mentions: /\bLLM\b/u,
    definition:
      'Per un LLM un token è un frammento di testo, spesso un pezzo di parola, preso da un vocabolario fisso di decine di migliaia di voci. È un concetto diverso dai token di ELIZA, che sono parole intere, numeri o segni.',
  },
  {
    term: 'Distribuzione di probabilità',
    mentions: /probabilit/iu,
    definition:
      'Per ogni posizione della risposta un LLM assegna a ogni token del vocabolario una probabilità, e tutte insieme sommano a 1; poi ne sceglie uno. ELIZA non calcola probabilità: segue regole fisse, contatori e, nella modalità variata, un generatore pseudo-casuale.',
  },
];

/** Toglie i testi fra «», che riportano parole dell'utente o frasi del copione, non gergo. */
export function withoutQuotes(text: string): string {
  let current = text;
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(/«[^«»]*»/gu, '«»');
  }
  return current;
}

/** Restituisce le definizioni di tutti i termini tecnici presenti nei testi. */
export function glossaryFor(texts: readonly string[]): readonly GlossaryEntry[] {
  const text = texts.map(withoutQuotes).join('\n');
  return rules
    .filter((rule) => rule.mentions.test(text))
    .map(({ term, definition }) => ({ term, definition }));
}
