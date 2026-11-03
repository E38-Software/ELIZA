import type {
  DecompositionRule,
  ElizaScript,
  KeywordRule,
  PatternTerm,
  ReassemblyRule,
} from '../../core/types';
import { italianEmptyInput, italianFallback, italianNoMatch, italianRepeat } from './fallbacks';

function literal(value: string): PatternTerm {
  return { kind: 'literal', value };
}

function oneOf(values: readonly string[]): PatternTerm {
  return { kind: 'oneOf', values };
}

function wildcard(capture: string, min = 0, max = 12): PatternTerm {
  return { kind: 'wildcard', capture, min, max };
}

function response(id: string, template: string): ReassemblyRule {
  return { id, kind: 'reply', template };
}

function decomposition(
  id: string,
  pattern: readonly PatternTerm[],
  reassemblies: readonly ReassemblyRule[],
): DecompositionRule {
  return { id, pattern, reassemblies };
}

function replies(
  id: string,
  pattern: readonly PatternTerm[],
  templates: readonly string[],
): DecompositionRule {
  const decompositionId = `${id}-d1`;
  return decomposition(
    decompositionId,
    pattern,
    templates.map((template, index) => response(`${decompositionId}-r${index + 1}`, template)),
  );
}

function makeKeyword(
  id: string,
  priority: number,
  phrases: readonly string[],
  decompositions: readonly DecompositionRule[],
  options: Pick<KeywordRule, 'memoryPolicy' | 'redirectTo'> = {},
): KeywordRule {
  return {
    id: `it-${id}`,
    priority,
    triggers: phrases.map((phrase) => ({ tokens: phrase.split(/\s+/u) })),
    decompositions,
    ...options,
  };
}

function topic(
  id: string,
  priority: number,
  phrases: readonly string[],
  anchors: readonly string[],
  templates: readonly string[],
  options: Pick<KeywordRule, 'memoryPolicy' | 'redirectTo'> = {},
): KeywordRule {
  return makeKeyword(
    id,
    priority,
    phrases,
    [
      replies(
        `it-${id}`,
        [wildcard(`${id}-prima`), oneOf(anchors), wildcard(`${id}-dopo`)],
        templates,
      ),
    ],
    options,
  );
}

const familyWords = [
  'famiglia',
  'madre',
  'mamma',
  'mamme',
  'padre',
  'papà',
  'papa',
  'figlio',
  'figlia',
  'figli',
  'figlie',
  'fratello',
  'fratelli',
  'sorella',
  'sorelle',
  'genitore',
  'genitori',
];

const possessiveMemoryTemplates = [
  'Prima hai scritto: «{{input}}». Che cosa conta di più per te in questa frase?',
  'Riprendo le tue parole: «{{input}}». Vuoi aggiungere un dettaglio?',
  'Hai parlato di «{{input}}». Che cosa ti fa venire in mente?',
  'Tengo presente «{{input}}». Su quale parte vuoi soffermarti?',
] as const;

const memoryRule: ElizaScript['memoryRules'][number] = {
  id: 'personal',
  templates: possessiveMemoryTemplates,
};

const keywords: KeywordRule[] = [
  topic(
    'saluti',
    70,
    ['ciao', 'salve', 'buongiorno', 'buonasera', 'buon pomeriggio', 'ehi'],
    ['ciao', 'salve', 'buongiorno', 'buonasera', 'buon', 'ehi'],
    [
      'Ciao. Di che cosa vorresti parlare?',
      'Salve. Che cosa ti passa per la mente?',
      'Buongiorno. Da dove vuoi cominciare?',
      'Ciao, ti ascolto.',
    ],
  ),
  makeKeyword(
    'mi-sento',
    118,
    ['mi sento'],
    [
      replies(
        'it-mi-sento',
        [literal('mi'), literal('sento'), wildcard('stato', 1, 8)],
        ['Da quanto tempo ti senti {{stato}}?'],
      ),
    ],
  ),
  topic(
    'impossibilita',
    116,
    [
      'impossibile',
      'impossibilità',
      'non posso',
      'non riesco',
      'non ce la faccio',
      'non è possibile',
    ],
    ['impossibile', 'impossibilità', 'posso', 'riesco', 'riesce', 'faccio', 'possibile'],
    [
      'Che cosa rende difficile questo passaggio?',
      'Quale parte ti sembra impossibile in questo momento?',
      'Cosa hai già provato a fare?',
      'Possiamo guardare la situazione un passo alla volta.',
    ],
  ),
  topic(
    'negazioni',
    114,
    ['non', 'no', 'mai', 'niente', 'nessuno', 'nessuna', 'senza', 'non so', 'non credo'],
    ['non', 'no', 'mai', 'niente', 'nessuno', 'nessuna', 'senza', 'so', 'credo'],
    [
      'Che cosa vuoi dire con questa negazione?',
      'A quale parte ti riferisci quando dici di no?',
      'Puoi spiegarmi meglio che cosa non ti convince?',
      'Che cosa cambia per te quando dici «mai»?',
    ],
  ),
  topic(
    'risposte-brevi',
    108,
    ['sì', 'si', 'certo', 'forse', 'boh', 'okay', 'ok', 'grazie', 'prego', 'capisco'],
    ['sì', 'si', 'certo', 'forse', 'boh', 'okay', 'ok', 'grazie', 'prego', 'capisco'],
    [
      'Vuoi aggiungere qualcosa?',
      'Che cosa ti fa rispondere così?',
      'Cosa vorresti dire oltre a questo?',
      'Puoi raccontarmi di più?',
    ],
  ),
  makeKeyword(
    'genitori',
    102,
    ['genitori', 'i miei genitori', 'mamma e papà', 'madre e padre'],
    [
      decomposition(
        'it-genitori-d1',
        [wildcard('genitori-contesto', 0, 12)],
        [{ id: 'it-genitori-d1-r1', kind: 'redirect', target: 'it-famiglia' }],
      ),
    ],
  ),
  topic(
    'paura',
    98,
    [
      'paura',
      'paure',
      'temo',
      'temere',
      'spaventato',
      'spaventata',
      'spaventare',
      'terrorizzato',
      'terrorizzata',
    ],
    [
      'paura',
      'paure',
      'temo',
      'temere',
      'spaventato',
      'spaventata',
      'spaventare',
      'terrorizzato',
      'terrorizzata',
    ],
    [
      'Che cosa ti preoccupa di più?',
      'Quando hai cominciato a pensarci?',
      'Cosa succede quando questa paura si presenta?',
      'Vuoi descrivere meglio ciò che temi?',
    ],
  ),
  topic(
    'ansia',
    97,
    ['ansia', 'ansioso', 'ansiosa', 'agitato', 'agitata', 'preoccupato', 'preoccupata', 'in ansia'],
    ['ansia', 'ansioso', 'ansiosa', 'agitato', 'agitata', 'preoccupato', 'preoccupata'],
    [
      'Quale situazione associ a questa ansia?',
      'Come descriveresti quello che sta succedendo?',
      'C’è un momento in cui questa sensazione è più presente?',
      'Che cosa ti aiuterebbe a spiegare meglio questa preoccupazione?',
    ],
  ),
  topic(
    'tristezza',
    96,
    [
      'triste',
      'tristezza',
      'infelice',
      'giù',
      'abbattuto',
      'abbattuta',
      'sconsolato',
      'sconsolata',
    ],
    [
      'triste',
      'tristezza',
      'infelice',
      'giù',
      'abbattuto',
      'abbattuta',
      'sconsolato',
      'sconsolata',
    ],
    [
      'Da quanto tempo ci pensi?',
      'Che cosa colleghi a questa tristezza?',
      'Vuoi raccontarmi che cosa è successo?',
      'Quale parte di questa situazione pesa di più?',
    ],
  ),
  topic(
    'rabbia',
    95,
    ['rabbia', 'arrabbiato', 'arrabbiata', 'furioso', 'furiosa', 'irritato', 'irritata', 'odio'],
    ['rabbia', 'arrabbiato', 'arrabbiata', 'furioso', 'furiosa', 'irritato', 'irritata', 'odio'],
    [
      'Che cosa ha fatto nascere questa rabbia?',
      'Quando hai iniziato a sentirti così?',
      'Quale aspetto ti irrita di più?',
      'Come vorresti descrivere quello che è successo?',
    ],
  ),
  topic(
    'felicita',
    94,
    [
      'felice',
      'felicità',
      'contento',
      'contenta',
      'allegro',
      'allegra',
      'entusiasta',
      'sereno',
      'serena',
    ],
    [
      'felice',
      'felicità',
      'contento',
      'contenta',
      'allegro',
      'allegra',
      'entusiasta',
      'sereno',
      'serena',
    ],
    [
      'Che cosa ti rende felice in questa situazione?',
      'Da quanto tempo va così?',
      'Che cosa vorresti ricordare di questo momento?',
      'C’è qualcuno con cui vorresti condividere questa felicità?',
    ],
  ),
  topic(
    'solitudine',
    93,
    ['solo', 'sola', 'solitudine', 'isolato', 'isolata', 'escluso', 'esclusa', 'soli'],
    ['solo', 'sola', 'solitudine', 'isolato', 'isolata', 'escluso', 'esclusa', 'soli'],
    [
      'In quali momenti la solitudine si fa sentire di più?',
      'C’è qualcuno a cui vorresti parlare di questo?',
      'Che cosa significa per te sentirti solo o sola?',
      'Vuoi raccontarmi di una situazione recente?',
    ],
  ),
  topic('famiglia', 92, familyWords, familyWords, [
    'Che cosa succede nella tua famiglia?',
    'Quale persona della tua famiglia ti è venuta in mente?',
    'Vuoi raccontarmi qualcosa di più su questo rapporto?',
    'Che cosa significa per te questa relazione?',
  ]),
  topic(
    'partner',
    91,
    [
      'partner',
      'compagno',
      'compagna',
      'marito',
      'moglie',
      'fidanzato',
      'fidanzata',
      'relazione',
      'amore',
    ],
    [
      'partner',
      'compagno',
      'compagna',
      'marito',
      'moglie',
      'fidanzato',
      'fidanzata',
      'relazione',
      'amore',
    ],
    [
      'Che cosa vorresti raccontarmi di questo rapporto?',
      'Quale aspetto della relazione ti interessa di più?',
      'Come ti senti rispetto a questa situazione?',
      'Cosa speri che accada?',
    ],
  ),
  topic(
    'amici',
    90,
    ['amico', 'amica', 'amici', 'amiche', 'amicizia', 'amichevole'],
    ['amico', 'amica', 'amici', 'amiche', 'amicizia', 'amichevole'],
    [
      'Che cosa apprezzi di questa amicizia?',
      'Vuoi raccontarmi di una persona in particolare?',
      'Che cosa è successo tra voi?',
      'Come vorresti che andasse questo rapporto?',
    ],
  ),
  topic(
    'lavoro',
    89,
    [
      'lavoro',
      'lavorare',
      'lavoro',
      'ufficio',
      'collega',
      'colleghi',
      'capo',
      'carriera',
      'disoccupato',
      'disoccupata',
    ],
    [
      'lavoro',
      'lavorare',
      'ufficio',
      'collega',
      'colleghi',
      'capo',
      'carriera',
      'disoccupato',
      'disoccupata',
    ],
    [
      'Che cosa succede al lavoro?',
      'Quale parte del tuo lavoro occupa più i tuoi pensieri?',
      'Come descriveresti il rapporto con i colleghi?',
      'Che cosa vorresti cambiare nella situazione lavorativa?',
    ],
  ),
  topic(
    'sogni',
    88,
    ['sogno', 'sogni', 'sognare', 'sognato', 'sognata', 'incubo', 'incubi'],
    ['sogno', 'sogni', 'sognare', 'sognato', 'sognata', 'incubo', 'incubi'],
    [
      'Che cosa ricordi di questo sogno?',
      'Quale immagine ti è rimasta più impressa?',
      'Che cosa ti fa pensare a questo sogno?',
      'Ti capita spesso di sognare qualcosa di simile?',
    ],
  ),
  topic(
    'ricordi',
    87,
    [
      'ricordo',
      'ricordi',
      'ricordare',
      'ricordavo',
      'dimenticare',
      'memoria',
      'memorie',
      'passato',
    ],
    [
      'ricordo',
      'ricordi',
      'ricordare',
      'ricordavo',
      'dimenticare',
      'memoria',
      'memorie',
      'passato',
    ],
    [
      'Che cosa ti è tornato in mente?',
      'Quale dettaglio ricordi meglio?',
      'Come interpreti oggi quel ricordo?',
      'Vuoi raccontarmi quando è successo?',
    ],
  ),
  topic(
    'bisogno',
    86,
    ['bisogno', 'bisogni', 'ho bisogno', 'avrei bisogno', 'necessità', 'necessario'],
    ['bisogno', 'bisogni', 'necessità', 'necessario'],
    [
      'Di che cosa senti di avere bisogno?',
      'Che cosa rende importante questo bisogno?',
      'Da quanto tempo ci pensi?',
      'Cosa vorresti che succedesse rispetto a questo?',
    ],
  ),
  topic(
    'desiderio',
    85,
    ['desidero', 'desideri', 'desiderare', 'vorrei', 'voglio', 'volere', 'spero', 'sperare'],
    ['desidero', 'desideri', 'desiderare', 'vorrei', 'voglio', 'volere', 'spero', 'sperare'],
    [
      'Che cosa significherebbe per te ottenerlo?',
      'Da quanto tempo lo desideri?',
      'Quale sarebbe il primo passo, secondo te?',
      'Che cosa ti attira di più in questo desiderio?',
    ],
  ),
  topic(
    'dubbio',
    84,
    ['dubbio', 'dubbi', 'dubitare', 'forse', 'incerto', 'incerta', 'incertezza', 'non so se'],
    ['dubbio', 'dubbi', 'dubitare', 'forse', 'incerto', 'incerta', 'incertezza', 'so'],
    [
      'Quali possibilità stai considerando?',
      'Che cosa ti lascia incerto o incerta?',
      'Quale informazione ti aiuterebbe a decidere?',
      'Da dove nasce questo dubbio?',
    ],
  ),
  topic(
    'certezza',
    83,
    ['certo', 'certa', 'sicuro', 'sicura', 'convinto', 'convinta', 'sicuramente', 'ovvio'],
    ['certo', 'certa', 'sicuro', 'sicura', 'convinto', 'convinta', 'sicuramente', 'ovvio'],
    [
      'Che cosa ti dà questa certezza?',
      'Su quali elementi basi questa convinzione?',
      'Ti è sempre sembrato così?',
      'C’è qualcosa che potrebbe farti cambiare idea?',
    ],
  ),
  topic(
    'cause',
    82,
    ['perché', 'causa', 'causare', 'motivo', 'ragione', 'dipende', 'quindi'],
    ['perché', 'causa', 'causare', 'motivo', 'ragione', 'dipende', 'quindi'],
    [
      'Che cosa ti fa pensare che questa sia la causa?',
      'Quali altri motivi ti vengono in mente?',
      'Da che cosa pensi che dipenda?',
      'Che cosa è successo prima?',
    ],
  ),
  topic(
    'somiglianza',
    81,
    ['simile', 'somiglianza', 'assomiglia', 'uguale', 'come', 'analogo'],
    ['simile', 'somiglianza', 'assomiglia', 'uguale', 'analogo'],
    [
      'Quale somiglianza noti?',
      'Che cosa ti colpisce di questo paragone?',
      'In che cosa ti sembra simile?',
      'Che cosa significa per te questa somiglianza?',
    ],
  ),
  topic(
    'differenza',
    80,
    ['diverso', 'diversa', 'differenza', 'differenze', 'distinto', 'distinta', 'invece'],
    ['diverso', 'diversa', 'differenza', 'differenze', 'distinto', 'distinta', 'invece'],
    [
      'Qual è la differenza che noti?',
      'Che cosa cambia per te?',
      'Quale aspetto ti sembra più importante?',
      'Vuoi fare un esempio concreto?',
    ],
  ),
  topic(
    'sempre',
    79,
    ['sempre', 'continuamente', 'ogni volta', 'di continuo'],
    ['sempre', 'continuamente', 'ogni', 'continuo'],
    [
      'Ti viene in mente un esempio recente?',
      'È proprio ogni volta o ci sono eccezioni?',
      'Da quando hai questa impressione?',
      'Che cosa significa per te «sempre»?',
    ],
  ),
  makeKeyword(
    'mai',
    78,
    ['mai', 'non ho mai', 'non è mai'],
    [
      replies(
        'it-mai-alternativa',
        [
          literal('non'),
          wildcard('mai-contesto', 0, 10),
          literal('mai'),
          wildcard('mai-seguito', 0, 8),
        ],
        [
          'Che cosa intendi quando dici «mai»?',
          'Ti viene in mente un momento in cui è successo qualcosa di diverso?',
          'Da quanto tempo la pensi così?',
        ],
      ),
      replies(
        'it-mai',
        [wildcard('mai-inizio', 0, 8), literal('mai'), wildcard('mai-fine', 0, 8)],
        [
          'Che cosa intendi quando dici «mai»?',
          'Ti viene in mente un momento in cui è successo qualcosa di diverso?',
          'Da quanto tempo la pensi così?',
        ],
      ),
    ],
  ),
  topic(
    'tutti',
    77,
    ['tutti', 'tutte', 'ognuno', 'ognuna', 'chiunque', 'tutti quanti'],
    ['tutti', 'tutte', 'ognuno', 'ognuna', 'chiunque'],
    [
      'A chi stai pensando in particolare?',
      'Ti viene in mente un esempio concreto?',
      'Potrebbero esserci eccezioni?',
      'Che cosa ti fa parlare di tutti?',
    ],
  ),
  topic(
    'nessuno',
    76,
    ['nessuno', 'nessuna', 'nessun', 'nessuno mai'],
    ['nessuno', 'nessuna', 'nessun'],
    [
      'A chi ti riferisci?',
      'C’è una persona che potrebbe fare eccezione?',
      'Che cosa è successo perché ti sembri così?',
      'Vuoi spiegarmi meglio questa impressione?',
    ],
  ),
  topic(
    'possessivi-prima-persona',
    75,
    ['mio', 'mia', 'miei', 'mie', 'il mio', 'la mia', 'i miei', 'le mie'],
    ['mio', 'mia', 'miei', 'mie'],
    [
      'Che cosa rappresenta per te questa cosa?',
      'Vuoi raccontarmi qualcosa in più?',
      'Che cosa ti fa venire in mente?',
      'Quale parte vorresti approfondire?',
    ],
    { memoryPolicy: { ruleId: 'personal' } },
  ),
  topic(
    'psicologo',
    74,
    ['psicologo', 'psicologa', 'psicologi', 'psicologhe', 'consulente', 'terapeuta'],
    ['psicologo', 'psicologa', 'psicologi', 'psicologhe', 'consulente', 'terapeuta'],
    [
      'Che cosa significa per te parlare con un professionista?',
      'Vuoi raccontarmi che cosa ti ha fatto pensare a questa figura?',
      'Che cosa ti aspetteresti da un colloquio?',
      'Quale domanda vorresti porre?',
    ],
  ),
  topic(
    'terapia',
    73,
    ['terapia', 'terapie', 'terapeutico', 'terapeutica', 'cura', 'curare', 'trattamento'],
    ['terapia', 'terapie', 'terapeutico', 'terapeutica', 'cura', 'curare', 'trattamento'],
    [
      'Che cosa intendi con «terapia»?',
      'Che cosa vorresti sapere su questo tema?',
      'Quale aspetto ti interessa approfondire?',
      'Vuoi raccontarmi che cosa ti ha portato a pensarci?',
    ],
  ),
  topic(
    'intelligenza-artificiale',
    72,
    [
      'intelligenza artificiale',
      "un'intelligenza artificiale",
      "l'intelligenza artificiale",
      'ia',
      'intelligenze artificiali',
    ],
    ['intelligenza', 'artificiale', 'ia', 'artificiali'],
    [
      'Che cosa ti interessa dell’intelligenza artificiale?',
      'Che cosa ti aspetti da una macchina che conversa?',
      'Quale parte di questa tecnologia ti incuriosisce?',
      'Che cosa rende artificiale questa intelligenza, secondo te?',
    ],
  ),
  topic(
    'chatbot',
    71,
    ['chatbot', 'chat bot', 'bot conversazionale', 'assistente virtuale'],
    ['chatbot', 'chat', 'bot', 'assistente', 'virtuale'],
    [
      'Che cosa ti aspetti da questa conversazione?',
      'In che cosa un chatbot ti sembra utile?',
      'Che cosa ti incuriosisce di questo assistente?',
      'Come distingui una risposta utile da una automatica?',
    ],
  ),
  topic(
    'computer',
    70,
    ['computer', 'pc', 'calcolatore', 'macchina', 'macchine', 'tecnologia'],
    ['computer', 'pc', 'calcolatore', 'macchina', 'macchine', 'tecnologia'],
    [
      'Che cosa ti fa pensare a un computer?',
      'Quale macchina hai in mente?',
      'Che rapporto hai con questa tecnologia?',
      'Cosa vorresti che la macchina facesse?',
    ],
  ),
  topic(
    'riflessione-personale',
    60,
    ['io', 'me', 'mi', 'penso', 'credo', 'sento', 'sono', 'ho'],
    ['io', 'me', 'mi', 'penso', 'credo', 'sento', 'sono', 'ho'],
    [
      'Che cosa ti fa pensare a questo?',
      'Puoi spiegarmi meglio che cosa intendi?',
      'Da dove vorresti cominciare?',
      'Che significato ha per te?',
    ],
  ),
  makeKeyword(
    'cambio-argomento',
    20,
    ['altro', 'comunque'],
    [
      decomposition(
        'it-cambio-argomento-d1',
        [wildcard('cambio-contesto', 0, 12)],
        [
          response('it-cambio-argomento-d1-r1', 'Di che cosa vorresti parlare?'),
          { id: 'it-cambio-argomento-d1-r2', kind: 'newkey' },
          response('it-cambio-argomento-d1-r3', 'Che cosa ti passa per la mente?'),
        ],
      ),
    ],
  ),
];

export const italianScript: ElizaScript = {
  keywords,
  fallback: italianFallback,
  noMatch: italianNoMatch,
  repeat: italianRepeat,
  emptyInput: italianEmptyInput,
  memoryRules: [memoryRule],
};
