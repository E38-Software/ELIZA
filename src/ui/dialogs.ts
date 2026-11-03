export function connectDialog(
  dialog: HTMLDialogElement,
  opener: HTMLButtonElement,
  modal: boolean,
): void {
  const close = dialog.querySelector<HTMLButtonElement>('[data-close]');
  if (!close) throw new Error(`Pulsante di chiusura mancante: ${dialog.id}`);
  opener.addEventListener('click', () => {
    if (dialog.open) {
      dialog.focus();
      return;
    }
    if (modal) dialog.showModal();
    else dialog.show();
    opener.setAttribute('aria-expanded', 'true');
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    opener.setAttribute('aria-expanded', 'false');
    opener.focus();
  });
}

export function makeDraggable(dialog: HTMLDialogElement, handle: HTMLElement): () => void {
  let drag: { pointerId: number; x: number; y: number; left: number; top: number } | null = null;

  function position(left: number, top: number): void {
    const bounds = dialog.getBoundingClientRect();
    dialog.style.left = `${Math.max(0, Math.min(left, window.innerWidth - bounds.width))}px`;
    dialog.style.top = `${Math.max(0, Math.min(top, window.innerHeight - bounds.height))}px`;
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.margin = '0';
  }

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button')))
      return;
    const bounds = dialog.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: bounds.left,
      top: bounds.top,
    };
    handle.setPointerCapture(event.pointerId);
    handle.focus();
  });
  handle.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    position(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
  });
  handle.addEventListener('lostpointercapture', () => {
    drag = null;
  });
  handle.addEventListener('pointerup', (event) => {
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  });
  handle.addEventListener('keydown', (event) => {
    if (event.target !== handle) return;
    const offsets: Record<string, readonly [number, number]> = {
      ArrowLeft: [-20, 0],
      ArrowRight: [20, 0],
      ArrowUp: [0, -20],
      ArrowDown: [0, 20],
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const bounds = dialog.getBoundingClientRect();
    position(bounds.left + offset[0], bounds.top + offset[1]);
  });
  function keepInBounds(): void {
    if (!dialog.open) return;
    const bounds = dialog.getBoundingClientRect();
    position(bounds.left, bounds.top);
  }
  window.addEventListener('resize', keepInBounds);
  return keepInBounds;
}
