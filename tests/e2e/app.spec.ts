import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const disclaimer =
  'Questa è una ricostruzione storica di ELIZA basata su regole. Non comprende realmente ciò che scrivi e non sostituisce un professionista.';
const promptName = 'Scrivi un messaggio o un comando locale';

async function openApplication(page: import('@playwright/test').Page) {
  await page.goto('/');
  const prompt = page.getByRole('textbox', { name: promptName });
  await expect(prompt).toBeEnabled();
  return prompt;
}

async function submit(page: import('@playwright/test').Page, text: string) {
  const prompt = page.getByRole('textbox', { name: promptName });
  await prompt.fill(text);
  await prompt.press('Enter');
  await expect(prompt).toBeEnabled();
}

function conversation(page: import('@playwright/test').Page) {
  return page.getByRole('list', { name: 'Cronologia della conversazione' });
}

function assistantMessages(page: import('@playwright/test').Page) {
  return conversation(page).getByRole('listitem').filter({ hasText: 'ELIZA' });
}

test.describe('applicazione ELIZA locale', () => {
  test('mostra il boot del terminale verde e il disclaimer', async ({ page }) => {
    await openApplication(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ELIZA');
    await expect(page.getByText(/Ispirato ai terminali a fosfori verdi/)).toHaveCount(0);
    await expect(page.getByText(disclaimer, { exact: true })).toBeVisible();
    await expect(conversation(page)).toContainText('INIZIALIZZAZIONE TERMINALE');
    await expect(assistantMessages(page).first()).toContainText('Ciao. Di cosa vorresti parlare?');
  });

  test('apre la storia dal pulsante in alto, spiega il funzionamento e ripristina il focus', async ({
    page,
  }) => {
    await openApplication(page);
    const about = page.getByRole('button', { name: /Storia e funzionamento/ });
    const explanation = page.getByRole('dialog', { name: 'ELIZA: storia e funzionamento' });
    await expect(explanation).not.toBeVisible();
    await expect(about).toBeInViewport();
    await about.click();

    await expect(explanation).toBeVisible();
    await expect(explanation).toContainText('Joseph Weizenbaum');
    await expect(explanation).toContainText('MIT');
    await expect(explanation).toContainText('1966');
    await expect(explanation).toContainText('DOCTOR');
    await expect(explanation).toContainText(/regole/i);
    await expect(explanation).toContainText('effetto ELIZA');
    await expect(explanation).toContainText('Mi sento triste');
    await expect(explanation).toContainText('Variata');
    await expect(page.getByRole('button', { name: 'Chiudi storia e funzionamento' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(explanation).not.toBeVisible();
    await expect(about).toBeFocused();
  });

  test('mostra il logo e accredita E38 e Monari Pietro nell’intestazione e nel piè di pagina', async ({
    page,
  }) => {
    await openApplication(page);
    const header = page.getByRole('banner');
    const headerLink = header.getByRole('link', { name: /e38 srl/i });
    const monariHeaderLink = header.getByRole('link', { name: /monari pietro/i });
    const logo = headerLink.getByRole('img', { name: /e38 srl/i });
    await expect(logo).toBeVisible();
    await expect
      .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(headerLink).toHaveAttribute('href', /^https:\/\/e38\.it\/?$/);
    await expect(monariHeaderLink).toBeVisible();
    await expect(monariHeaderLink).toHaveAttribute('href', 'https://www.monaripietro.it/');
    const footer = page.getByRole('contentinfo');
    const footerLink = footer.getByRole('link', { name: /e38 srl/i });
    const monariFooterLink = footer.getByRole('link', { name: /monari pietro/i });
    await expect(footerLink).toBeVisible();
    await expect(footerLink).toHaveAttribute('href', /^https:\/\/e38\.it\/?$/);
    await expect(monariFooterLink).toBeVisible();
    await expect(monariFooterLink).toHaveAttribute('href', 'https://www.monaripietro.it/');
    for (const link of [headerLink, monariHeaderLink, footerLink, monariFooterLink]) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
      await expect(link).toHaveAccessibleName(/nuova scheda/i);
    }
  });

  test('invia un messaggio e riceve una risposta in italiano', async ({ page }) => {
    await openApplication(page);
    await submit(page, 'Mi sento triste');

    await expect(assistantMessages(page).last()).toContainText('Da quanto tempo ti senti triste?');
  });

  test('raccoglie sempre la traccia; TRACE ON/OFF controllano solo la finestra', async ({
    page,
  }) => {
    await openApplication(page);
    const panel = page.getByRole('dialog', { name: 'Il percorso decisionale' });
    await expect(panel).not.toBeVisible();
    await submit(page, 'Mi sento triste');
    await expect(panel).not.toBeVisible();
    await page.getByRole('button', { name: /Esplora le decisioni/ }).click();
    await expect(panel).toBeVisible();
    await expect(page.locator('#trace-summary')).toHaveText('Scambio 1 · HISTORICAL');
    await panel.getByRole('button', { name: /Voglio i dettagli tecnici/ }).click();
    const stepGlossary = page.locator('#trace-step .glossary');
    await expect(stepGlossary).toHaveAttribute('open', '');
    await expect(stepGlossary.locator('dt', { hasText: 'NFC' })).toBeVisible();
    await expect(stepGlossary).toContainText('accento combinante');
    await stepGlossary.locator('summary').click();
    await panel.getByRole('button', { name: 'Avanti' }).click();
    await expect(page.locator('#trace-progress')).toContainText('Passaggio 2 di 6');
    await expect(stepGlossary).not.toHaveAttribute('open', '');
    await panel.getByRole('button', { name: 'Mostra tutto l’albero' }).click();
    await expect(page.locator('#tree-glossary')).toBeVisible();
    await expect(page.locator('#tree-glossary dt', { hasText: 'Stack' })).toBeVisible();
    await expect(page.locator('#decision-tree')).toContainText('it-mi-sento · priorità');
    await expect(page.locator('#decision-tree')).toContainText('it-mi-sento-d1: mi sento');
    await panel.getByRole('button', { name: 'Passaggio 3: Decomposizione' }).click();
    await expect(page.locator('#trace-step')).toContainText('pattern: mi sento');
    await panel.getByRole('button', { name: 'Passaggio 5: Ricomposizione' }).click();
    await expect(page.locator('#trace-step')).toContainText('indice di rotazione');
    await panel.getByText('Dati tecnici completi dell’ultimo scambio').click();
    await expect(page.locator('#trace-content')).toContainText('originalInput');
    await expect(page.locator('#trace-content')).toContainText('selectedKeyword');

    await submit(page, 'TRACE OFF');
    await expect(panel).not.toBeVisible();
    await submit(page, 'Mia madre mi ascolta');
    await submit(page, 'TRACE ON');
    await expect(panel).toBeVisible();
    await expect(page.locator('#trace-summary')).toHaveText('Scambio 2 · HISTORICAL');
    await expect(page.locator('#trace-content')).toContainText('Mia madre mi ascolta');
    await submit(page, 'TRACE OFF');

    const downloadPromise = page.waitForEvent('download');
    await submit(page, 'EXPORT');
    const download = await downloadPromise;
    const path = await download.path();
    if (!path) throw new Error('Esportazione non scaricata.');
    const exported = await readFile(path, 'utf8');
    expect(exported).toContain('Scambio 1');
    expect(exported).toContain('Scambio 2');
    expect(exported).toContain('selectedKeyword: it-mi-sento');
  });

  test('chiede il livello all’apertura e lo ricorda solo nella scheda', async ({ page }) => {
    await openApplication(page);
    const opener = page.getByRole('button', { name: /Esplora le decisioni/ });
    const panel = page.getByRole('dialog', { name: 'Il percorso decisionale' });
    await opener.click();
    await expect(panel.getByRole('heading', { name: 'Da dove partiamo?' })).toBeFocused();
    await expect(panel.getByRole('button', { name: /Parto da zero/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Conosco le basi/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Voglio i dettagli tecnici/ })).toBeVisible();
    await expect(panel.getByRole('group', { name: 'Livello delle spiegazioni' })).toBeHidden();
    await panel.getByRole('button', { name: /Conosco le basi/ }).click();
    await expect(page.locator('#trace-level-picker')).toBeHidden();
    await expect(page.locator('#trace-progress')).toContainText('Invia un messaggio');
    await expect(panel.getByRole('button', { name: 'Intermedio', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Chiudi il pannello decisionale' }).click();
    await opener.click();
    await expect(page.locator('#trace-level-picker')).toBeHidden();
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  });

  test('esplora l’albero passo passo, senza animazioni automatiche', async ({ page }) => {
    await openApplication(page);
    await submit(page, 'SPEED 0');
    await page.getByRole('button', { name: /Esplora le decisioni/ }).click();
    const panel = page.getByRole('dialog', { name: 'Il percorso decisionale' });
    await panel.getByRole('button', { name: /Parto da zero/ }).click();
    await submit(page, 'Mia madre mi ascolta');
    const progress = page.locator('#trace-progress');
    const visible = page.locator('#decision-tree .tree-node:visible');
    await expect(progress).toContainText('Passaggio 1 di 6');
    await expect(visible).toHaveCount(1);
    await expect(page.locator('#trace-step')).toContainText('lettera per lettera');
    await expect(page.locator('#trace-step .glossary')).toHaveCount(0);
    await expect(page.locator('#tree-glossary')).toBeHidden();
    await page.waitForTimeout(3200);
    await expect(progress).toContainText('Passaggio 1 di 6');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

    await panel.getByRole('button', { name: 'Avanti' }).click();
    await expect(progress).toContainText('Passaggio 2 di 6');
    await expect(
      panel.getByRole('button', { name: 'Passaggio 2: Cerca parole che conosce' }),
    ).toHaveAttribute('aria-current', 'step');
    await expect(visible).toHaveCount(4);
    await expect(page.locator('#decision-tree .tree-node[data-new]:visible')).toHaveCount(3);
    await expect(page.locator('#trace-legend')).toContainText('2 non provati');
    await panel.getByRole('button', { name: 'Indietro' }).click();
    await expect(progress).toContainText('Passaggio 1 di 6');

    await panel.getByRole('button', { name: 'Mostra tutto l’albero' }).click();
    await expect(progress).toContainText('Passaggio 6 di 6');
    const response = page.locator('#decision-tree .tree-node[data-kind="response"]');
    await expect(response).toBeVisible();
    await expect(response).toContainText('Che cosa succede nella tua famiglia?');
    await expect(page.locator('#decision-tree [data-state="alternative"]:visible')).not.toHaveCount(
      0,
    );
    await expect(page.locator('#decision-tree [data-trunk="joint"]:visible')).not.toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Avanti' })).toBeDisabled();
    await expect(page.locator('#trace-step')).toContainText('LLM');

    await panel.getByRole('button', { name: 'Esperto', exact: true }).click();
    await expect(progress).toContainText('Passaggio 6 di 6 · Output');
    await expect(page.locator('#decision-tree')).toContainText('it-famiglia');
    await expect(page.locator('#trace-step .step-technical')).toHaveAttribute('open', '');

    await submit(page, 'xyzzy');
    await expect(page.locator('#trace-summary')).toHaveText('Scambio 2 · HISTORICAL');
    await expect(progress).toContainText('Passaggio 1 di 6');
    await expect(page.locator('#decision-tree')).not.toContainText('it-famiglia');
    await page.getByRole('button', { name: 'Chiudi il pannello decisionale' }).click();
    await expect(page.getByRole('button', { name: /Esplora le decisioni/ })).toBeFocused();
  });

  test('spiega visivamente memoria vuota, nuovo ricordo e ricordo recuperato', async ({ page }) => {
    await openApplication(page);
    await submit(page, 'Mi sento triste');
    await page.getByRole('button', { name: /Esplora le decisioni/ }).click();
    await page.getByRole('button', { name: /Conosco le basi/ }).click();
    const memoryButton = page.getByRole('button', {
      name: 'Passaggio 4: Riusa parole e piccoli ricordi',
    });
    await memoryButton.click();
    const memory = page.locator('#trace-step');
    await expect(memory).toContainText('Non è un punteggio');
    await expect(memory).toContainText('non tutta la conversazione');
    await expect(memory.locator('.trace-comparison strong')).toHaveText([
      'Nessun ricordo',
      'Nessun ricordo',
    ]);
    await submit(page, 'La mia bicicletta è rossa');
    await memoryButton.click();
    await expect(memory.locator('.trace-comparison strong')).toHaveText([
      'Nessun ricordo',
      '1 ricordo',
    ]);
    await expect(memory).toContainText('preparato nuovi ricordi');
    await expect(page.locator('#decision-tree .tree-node[data-kind="memory"]')).toContainText(
      'Ricordo conservato per un turno futuro',
    );
    await submit(page, 'xyzzy');
    await memoryButton.click();
    await expect(memory.locator('.trace-comparison strong')).toHaveText([
      '1 ricordo',
      'Nessun ricordo',
    ]);
    await expect(memory).toContainText('recuperato il ricordo più vecchio');
    await page.getByRole('button', { name: 'Mostra tutto l’albero' }).click();
    await expect(
      page.locator('#decision-tree .tree-node[data-kind="memory"][data-state="selected"]'),
    ).toBeVisible();
  });

  test('sposta il pannello con mouse e tastiera e lo mantiene nel viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openApplication(page);
    await page.getByRole('button', { name: /Esplora le decisioni/ }).click();
    const panel = page.locator('#trace-dialog');
    const handle = page.locator('#trace-handle');
    const before = await panel.boundingBox();
    const grip = await handle.boundingBox();
    if (!before || !grip) throw new Error('Pannello non visibile.');
    await page.mouse.move(grip.x + 30, grip.y + 20);
    await page.mouse.down();
    await page.mouse.move(grip.x - 170, grip.y + 80, { steps: 8 });
    await page.mouse.up();
    const after = await panel.boundingBox();
    if (!after) throw new Error('Pannello non visibile dopo il trascinamento.');
    expect(after.x).toBeCloseTo(before.x - 200);
    expect(after.y).toBeCloseTo(before.y + 60);
    await handle.focus();
    await handle.press('ArrowLeft');
    const keyboard = await panel.boundingBox();
    expect(keyboard?.x).toBeCloseTo(after.x - 20);
    await page.setViewportSize({ width: 320, height: 600 });
    await expect
      .poll(async () => {
        const bounds = await panel.boundingBox();
        return bounds ? bounds.x + bounds.width : Infinity;
      })
      .toBeLessThanOrEqual(320);
    const mobile = await panel.boundingBox();
    if (!mobile) throw new Error('Pannello non visibile su mobile.');
    expect(mobile.x).toBeGreaterThanOrEqual(0);
    expect(mobile.y).toBeGreaterThanOrEqual(0);
    expect(mobile.x + mobile.width).toBeLessThanOrEqual(320);
    expect(mobile.y + mobile.height).toBeLessThanOrEqual(600);
    await handle.press('Escape');
    await expect(panel).not.toBeVisible();
  });

  test('RESET svuota albero, passaggi e dati della traccia', async ({ page }) => {
    await openApplication(page);
    await submit(page, 'Mi sento triste');
    await page.getByRole('button', { name: /Esplora le decisioni/ }).click();
    await page.getByRole('button', { name: /Conosco le basi/ }).click();
    await expect(page.locator('#trace-step-title')).toBeFocused();
    await expect(page.locator('#decision-tree .tree-node')).not.toHaveCount(0);
    const next = page.getByRole('button', { name: 'Avanti' });
    await expect(next).toBeEnabled();
    await submit(page, 'RESET');
    await expect(page.locator('#decision-tree')).toBeEmpty();
    await expect(page.locator('#trace-navigation')).toBeEmpty();
    await expect(page.locator('#trace-content')).toBeEmpty();
    await expect(next).toBeDisabled();
    await submit(page, 'Mi sento triste');
    await expect(page.locator('#trace-summary')).toHaveText('Scambio 1 · HISTORICAL');
    await expect(next).toBeEnabled();
  });

  test('sceglie fosfori verdi o ambra e offre motion e testo regolabili', async ({ page }) => {
    await openApplication(page);
    await submit(page, 'Mi sento triste');
    const messageCount = await conversation(page).getByRole('listitem').count();

    await expect(page.locator('.session-line')).not.toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'green');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(6, 17, 9)');
    await expect(page.getByRole('region', { name: 'Terminale ELIZA' })).toHaveCSS(
      'color',
      'rgb(164, 233, 166)',
    );
    await page.getByText('Impostazioni', { exact: true }).click();
    await expect(page.locator('.session-line')).toBeVisible();

    const theme = page.getByRole('combobox', { name: 'Colore schermo' });
    await expect(theme).toHaveValue('GREEN');
    await theme.selectOption('AMBER');
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'amber');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(26, 14, 0)');
    await expect(page.getByRole('region', { name: 'Terminale ELIZA' })).toHaveCSS(
      'color',
      'rgb(255, 224, 162)',
    );
    await expect(page.getByRole('textbox', { name: promptName })).toHaveCSS(
      'caret-color',
      'rgb(255, 224, 162)',
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1a0e00');
    await expect(conversation(page).getByRole('listitem')).toHaveCount(messageCount);
    await expect(assistantMessages(page).last()).toContainText('Da quanto tempo ti senti triste?');
    await submit(page, 'THEME GREEN');
    await expect(theme).toHaveValue('GREEN');
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'green');
    await submit(page, 'THEME AMBER');
    await expect(theme).toHaveValue('AMBER');
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'amber');
    await theme.selectOption('GREEN');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(6, 17, 9)');

    const motion = page.getByRole('checkbox', { name: /Animazioni discrete/ });
    await expect(motion).toBeChecked();
    await motion.uncheck();
    await expect(page.locator('body')).toHaveAttribute('data-motion', 'off');
    await motion.check();
    await expect(page.locator('body')).toHaveAttribute('data-motion', 'on');

    const fontSize = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    const scaled = [
      '.message-body',
      '.message-label',
      '.disclaimer',
      '.feature-button',
      '.setting',
    ];
    const before = await Promise.all(scaled.map(fontSize));
    expect(Math.min(...before)).toBeGreaterThanOrEqual(14);
    const textSize = page.getByRole('slider', { name: 'Dimensione testo' });
    await expect(textSize).toHaveValue('120');
    await textSize.focus();
    await textSize.press('End');
    await expect(textSize).toHaveValue('200');
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.getPropertyValue('--text-scale')),
      )
      .toBe('2');
    const after = await Promise.all(scaled.map(fontSize));
    after.forEach((size, index) => expect(size / (before[index] ?? 1)).toBeCloseTo(200 / 120, 2));
  });

  test('esegue HELP, CLEAR, RESET, MODE e SEED come comandi locali', async ({ page }) => {
    await openApplication(page);
    const history = conversation(page);

    await submit(page, 'HELP');
    await expect(history).toContainText('Per iniziare:');
    await expect(history).toContainText('Il motore non comprende il testo');
    await expect(history).toContainText('Non è una terapeuta');
    await expect(history).toContainText('Comandi locali:');
    await expect(history).toContainText('Tengo presente «La mia bicicletta è rossa»');

    await submit(page, 'Mi sento triste');
    await expect(page.getByText(/^SCAMBI/).locator('strong')).toHaveText('1');
    await submit(page, 'CLEAR');
    await expect(history.getByRole('listitem')).toHaveCount(0);
    await expect(
      page.getByText('Schermo pulito. Stato e cronologia in memoria sono invariati.', {
        exact: true,
      }),
    ).toBeVisible();

    await submit(page, 'RESET');
    await expect(page.getByText(/^SCAMBI/).locator('strong')).toHaveText('0');
    await expect(history).toContainText('Stato del motore azzerato');

    await submit(page, 'MODE VARIED');
    await expect(page.locator('#session-mode-label')).toHaveText('VARIATA');

    await submit(page, 'SEED 42');
    await expect(page.getByText(/^SEED/).locator('strong')).toHaveText('42');
  });

  test('esporta solo dopo il comando esplicito EXPORT', async ({ page }) => {
    await openApplication(page);
    let downloadCount = 0;
    page.on('download', () => {
      downloadCount += 1;
    });

    await submit(page, 'Mi sento triste');
    expect(downloadCount).toBe(0);

    const downloadPromise = page.waitForEvent('download');
    await submit(page, 'EXPORT');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^eliza-sessione-\d{4}-\d{2}-\d{2}\.txt$/);
    expect(downloadCount).toBe(1);
  });

  test('elimina anche annunci e bozze, senza interrompere una risposta in corso', async ({
    page,
  }) => {
    const prompt = await openApplication(page);
    const secret = 'Il mio diario si chiama neranio';
    const announcer = page.locator('#announcer');

    await submit(page, 'MODE DETERMINISTIC');
    await page.getByText('Impostazioni', { exact: true }).click();
    const deleteButton = page.getByRole('button', { name: 'Elimina sessione' });
    await submit(page, 'SPEED 80');
    await prompt.fill(secret);
    await prompt.press('Enter');
    await expect(deleteButton).toBeDisabled();
    await expect(prompt).toBeEnabled({ timeout: 15_000 });
    await submit(page, 'SPEED 0');
    await submit(page, secret);
    await expect(announcer).toContainText(secret);
    await expect(page.locator('#trace-content')).toContainText(secret);

    await prompt.fill('Una bozza privata');
    page.once('dialog', (dialog) => void dialog.accept());
    await deleteButton.click();
    await expect(prompt).toHaveValue('');
    await expect(announcer).toBeEmpty();
    await expect(conversation(page)).not.toContainText(secret);
    await expect(page.locator('#trace-content')).not.toContainText(secret);

    await submit(page, 'MODE DETERMINISTIC');
    await submit(page, secret);
    await submit(page, secret);
    await expect(announcer).toContainText(secret);
    page.once('dialog', (dialog) => void dialog.accept());
    await submit(page, 'DELETE SESSION');
    await expect(announcer).toBeEmpty();
    await expect(conversation(page)).not.toContainText(secret);
  });

  test('la risposta safety è mostrata senza una risposta del motore', async ({ page }) => {
    await openApplication(page);
    await submit(page, 'TRACE ON');
    await submit(page, 'Mi sento triste');
    const previousAssistantCount = await assistantMessages(page).count();

    await submit(page, 'Voglio suicidarmi.');

    await expect(conversation(page)).toContainText('NOTA DI SICUREZZA');
    await expect(conversation(page)).toContainText('Se sei in pericolo immediato');
    await expect(assistantMessages(page)).toHaveCount(previousAssistantCount);
    await expect(page.getByText('Nessuna traccia disponibile', { exact: true })).toBeVisible();
    await expect(page.locator('#trace-progress')).toContainText('Il motore non è stato invocato');
    await expect(page.locator('#decision-tree')).toBeEmpty();
    await expect(page.locator('#trace-content')).toBeEmpty();
  });

  test('invio e focus del prompt sono utilizzabili da tastiera', async ({ page }) => {
    const prompt = await openApplication(page);
    await expect(prompt).toBeFocused();
    await prompt.fill('Mi sento triste');
    await prompt.press('Enter');

    await expect(prompt).toBeEnabled();
    await expect(assistantMessages(page).last()).toContainText('Da quanto tempo ti senti triste?');
  });

  test('la riga prompt segue la risposta nello stesso scroll ed è allineata al simbolo >', async ({
    page,
  }) => {
    await openApplication(page);
    await submit(page, 'Mi sento triste');

    const form = page.getByRole('form', { name: 'Riga di input' });
    await expect(form).toBeVisible();
    const layout = await page.evaluate(() => {
      const scroller = document.getElementById('terminal-scroll');
      const transcript = document.getElementById('conversation');
      const promptForm = document.getElementById('prompt-form');
      const promptSymbol = document.querySelector<HTMLElement>('.prompt-symbol');
      const promptInput = document.getElementById('prompt-input');
      const lastMessage = transcript?.lastElementChild;
      if (
        !(scroller instanceof HTMLElement) ||
        !(transcript instanceof HTMLOListElement) ||
        !(promptForm instanceof HTMLFormElement) ||
        !(promptSymbol instanceof HTMLElement) ||
        !(promptInput instanceof HTMLInputElement) ||
        !lastMessage
      ) {
        throw new Error('Il prompt terminale o la trascrizione non sono disponibili.');
      }

      const formStyle = getComputedStyle(promptForm);
      const inputStyle = getComputedStyle(promptInput);
      const formBounds = promptForm.getBoundingClientRect();
      const lastMessageBounds = lastMessage.getBoundingClientRect();
      const symbolBounds = promptSymbol.getBoundingClientRect();
      const inputBounds = promptInput.getBoundingClientRect();
      return {
        sharesScrollContainer: promptForm.parentElement === scroller,
        immediatelyFollowsTranscript: transcript.nextElementSibling === promptForm,
        followsLastMessage: formBounds.top >= lastMessageBounds.bottom,
        gapAfterLastMessage: formBounds.top - lastMessageBounds.bottom,
        promptAndInputShareLine:
          symbolBounds.top < inputBounds.bottom && inputBounds.top < symbolBounds.bottom,
        flexBaselineAlignment: formStyle.alignItems === 'baseline',
        inputOutline: inputStyle.outlineStyle,
        inputBorder: inputStyle.borderStyle,
        nativeCaretColor: inputStyle.caretColor,
        focused: document.activeElement === promptInput,
        focusRowBorder: formStyle.borderBottomColor,
        fakeCursorContent: getComputedStyle(promptSymbol, '::after').content,
        placeholder: promptInput.getAttribute('placeholder'),
        lastMessageText: lastMessage.textContent,
        scrollAtBottom: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2,
      };
    });

    expect(layout.sharesScrollContainer).toBe(true);
    expect(layout.immediatelyFollowsTranscript).toBe(true);
    expect(layout.followsLastMessage).toBe(true);
    expect(layout.gapAfterLastMessage).toBeLessThan(8);
    expect(layout.promptAndInputShareLine).toBe(true);
    expect(layout.flexBaselineAlignment).toBe(true);
    expect(layout.inputOutline).toBe('none');
    expect(layout.inputBorder).toBe('none');
    expect(layout.nativeCaretColor).not.toBe('transparent');
    expect(layout.focused).toBe(true);
    expect(layout.focusRowBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(layout.fakeCursorContent).toBe('none');
    expect(layout.placeholder).toBeNull();
    expect(layout.lastMessageText).toContain('Da quanto tempo ti senti triste?');
    expect(layout.scrollAtBottom).toBe(true);
    await expect(page.getByText(/Terminale pronto\./)).not.toBeVisible();
    await expect(page.getByText('Solo locale · Sessione volatile', { exact: true })).toHaveCount(0);
  });

  test('non crea scroll orizzontale a 320 pixel', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await openApplication(page);

    const overflow = await page.evaluate(() => {
      const overflowingElements = Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            name: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`,
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        })
        .filter(
          ({ left, right, scrollWidth, clientWidth }) =>
            left < -1 || right > window.innerWidth + 1 || scrollWidth > clientWidth + 1,
        )
        .slice(0, 12);
      return {
        hasHorizontalOverflow:
          Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) >
          window.innerWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        overflowingElements,
      };
    });
    expect(overflow.hasHorizontalOverflow, JSON.stringify(overflow)).toBe(false);
  });

  test('rimane utilizzabile con una larghezza ridotta dallo zoom', async ({ page }) => {
    await page.setViewportSize({ width: 174, height: 900 });
    const prompt = await openApplication(page);
    await submit(page, 'Mi sento triste');
    await expect(assistantMessages(page).last()).toContainText('Da quanto tempo ti senti triste?');
    await expect(prompt).toBeFocused();
    await page.getByText('Impostazioni', { exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("rispetta prefers-reduced-motion all'avvio", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApplication(page);

    await page.getByText('Impostazioni', { exact: true }).click();
    await expect(page.getByRole('checkbox', { name: /Animazioni discrete/ })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Digitazione graduale/ })).not.toBeChecked();
    await expect(page.locator('body')).toHaveAttribute('data-motion', 'off');
  });

  test('blocca richieste fuori origine e continua offline senza storage persistente', async ({
    page,
  }, testInfo) => {
    const configuredBaseURL = testInfo.project.use.baseURL;
    if (typeof configuredBaseURL !== 'string') {
      throw new Error('Il progetto Playwright deve configurare baseURL.');
    }
    const appOrigin = new URL(configuredBaseURL).origin;
    const externalRequests: string[] = [];
    const requestsWhileOffline: string[] = [];
    let offline = false;
    const context = page.context();

    context.on('request', (request) => {
      const requestURL = request.url();
      if (new URL(requestURL).origin !== appOrigin) externalRequests.push(requestURL);
      if (offline) requestsWhileOffline.push(requestURL);
    });
    await context.route('**/*', async (route) => {
      const requestURL = route.request().url();
      if (new URL(requestURL).origin !== appOrigin) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await context.routeWebSocket('**/*', async (webSocket) => {
      const requestURL = webSocket.url();
      if (new URL(requestURL).origin !== appOrigin) {
        externalRequests.push(requestURL);
        await webSocket.close();
        return;
      }
      webSocket.connectToServer();
    });

    await openApplication(page);
    await context.setOffline(true);
    offline = true;
    await submit(page, 'Mi sento triste');

    await expect(assistantMessages(page).last()).toContainText('Da quanto tempo ti senti triste?');
    expect(externalRequests).toEqual([]);
    expect(requestsWhileOffline).toEqual([]);

    const storage = await page.evaluate(async () => {
      const databases =
        typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
      const cacheNames = 'caches' in window ? await caches.keys() : [];
      return {
        localStorage: localStorage.length,
        sessionStorage: sessionStorage.length,
        cookies: document.cookie,
        databaseNames: databases.map(({ name }) => name).filter(Boolean),
        cacheNames,
      };
    });
    expect(storage).toEqual({
      localStorage: 0,
      sessionStorage: 0,
      cookies: '',
      databaseNames: [],
      cacheNames: [],
    });
  });
});
