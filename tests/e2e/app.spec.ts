import { expect, test } from '@playwright/test';

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

  test('spiega in modo discreto la storia e il funzionamento di ELIZA', async ({ page }) => {
    await openApplication(page);
    const about = page.getByText('Cos’è ELIZA?', { exact: true });
    await expect(about).toBeVisible();
    await about.click();

    const explanation = about.locator('..');
    await expect(explanation).toContainText('Joseph Weizenbaum');
    await expect(explanation).toContainText('MIT');
    await expect(explanation).toContainText('1966');
    await expect(explanation).toContainText('DOCTOR');
    await expect(explanation).toContainText(/regole/i);
    await expect(explanation).not.toContainText(/reinterpretazione locale/i);
  });

  test('mostra il logo e accredita e38 srl nell’intestazione e nel piè di pagina', async ({
    page,
  }) => {
    await openApplication(page);
    const headerLink = page.getByRole('banner').getByRole('link', { name: /e38 srl/i });
    const logo = headerLink.getByRole('img', { name: /e38 srl/i });
    await expect(logo).toBeVisible();
    await expect
      .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(headerLink).toHaveAttribute('href', /^https:\/\/e38\.it\/?$/);
    const footerLink = page.getByRole('contentinfo').getByRole('link', { name: /e38 srl/i });
    await expect(footerLink).toBeVisible();
    await expect(footerLink).toHaveAttribute('href', /^https:\/\/e38\.it\/?$/);
    for (const link of [headerLink, footerLink]) {
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

  test('TRACE ON mostra i campi e TRACE OFF interrompe la nuova traccia', async ({ page }) => {
    await openApplication(page);
    await submit(page, 'TRACE ON');
    await page.getByText('Traccia locale', { exact: true }).click();
    await expect(page.getByRole('checkbox', { name: /Mostra la traccia/ })).toBeChecked();

    await submit(page, 'Mi sento triste');
    const traceSummary = page.getByText(/Scambio 1 · \d+ campi/);
    const traceDetails = traceSummary.locator('..');
    await expect(traceSummary).toBeVisible();
    await expect(traceDetails).toContainText('originalInput');
    await expect(traceDetails).toContainText('selectedKeyword');

    await submit(page, 'TRACE OFF');
    await expect(page.getByRole('checkbox', { name: /Mostra la traccia/ })).not.toBeChecked();
    await submit(page, 'Mi sento triste');
    await expect(page.getByText(/Scambio 1 ·/)).toBeVisible();
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

    const textSize = page.getByRole('slider', { name: 'Dimensione testo' });
    await textSize.focus();
    await textSize.press('End');
    await expect(textSize).toHaveValue('22');
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.style.getPropertyValue('--terminal-font-size'),
        ),
      )
      .toBe('22px');
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
    await submit(page, 'TRACE ON');
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
    await page.getByText('Traccia locale', { exact: true }).click();
    const previousAssistantCount = await assistantMessages(page).count();

    await submit(page, 'Voglio suicidarmi.');

    await expect(conversation(page)).toContainText('NOTA DI SICUREZZA');
    await expect(conversation(page)).toContainText('Se sei in pericolo immediato');
    await expect(assistantMessages(page)).toHaveCount(previousAssistantCount);
    await expect(page.getByText('Nessuna traccia disponibile', { exact: true })).toBeVisible();
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
