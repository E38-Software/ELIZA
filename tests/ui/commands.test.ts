import { describe, expect, it } from 'vitest';
import { parseUiCommand } from '../../src/ui/commands';

describe('parseUiCommand', () => {
  it('riconosce i comandi semplici senza distinzione di maiuscole', () => {
    expect(parseUiCommand(' help ')).toEqual({ type: 'help' });
    expect(parseUiCommand('ABOUT')).toEqual({ type: 'about' });
    expect(parseUiCommand('clear')).toEqual({ type: 'clear' });
    expect(parseUiCommand('RESET')).toEqual({ type: 'reset' });
    expect(parseUiCommand('EXPORT')).toEqual({ type: 'export' });
  });

  it('accetta il prefisso storico facoltativo e i comandi sessione', () => {
    expect(parseUiCommand('*TRACE ON')).toEqual({ type: 'trace', enabled: true });
    expect(parseUiCommand('trace off')).toEqual({ type: 'trace', enabled: false });
    expect(parseUiCommand('delete session')).toEqual({ type: 'delete-session' });
  });

  it('limita le modalità ai valori dichiarati', () => {
    expect(parseUiCommand('MODE HISTORICAL')).toEqual({ type: 'mode', mode: 'HISTORICAL' });
    expect(parseUiCommand('mode deterministic')).toEqual({ type: 'mode', mode: 'DETERMINISTIC' });
    expect(parseUiCommand('MODE VARIED')).toEqual({ type: 'mode', mode: 'VARIED' });
  });

  it('sceglie il colore del terminale con un comando locale', () => {
    expect(parseUiCommand('THEME GREEN')).toEqual({ type: 'theme', theme: 'GREEN' });
    expect(parseUiCommand('*theme amber')).toEqual({ type: 'theme', theme: 'AMBER' });
    expect(parseUiCommand('THEME').type).toBe('invalid');
    expect(parseUiCommand('THEME WHITE').type).toBe('invalid');
    expect(parseUiCommand('THEME AMBER GREEN').type).toBe('invalid');
  });

  it('valida seed uint32 e velocità intere nel range della UI', () => {
    expect(parseUiCommand('SEED 0')).toEqual({ type: 'seed', seed: 0 });
    expect(parseUiCommand('SEED 4294967295')).toEqual({ type: 'seed', seed: 0xffff_ffff });
    expect(parseUiCommand('SPEED 80')).toEqual({ type: 'speed', milliseconds: 80 });
    expect(parseUiCommand('SPEED 0')).toEqual({ type: 'speed', milliseconds: 0 });
    expect(parseUiCommand('SEED -1').type).toBe('invalid');
    expect(parseUiCommand('SEED 4294967296').type).toBe('invalid');
    expect(parseUiCommand('SPEED 81').type).toBe('invalid');
    expect(parseUiCommand('SPEED 1.5').type).toBe('invalid');
  });

  it('distingue input conversazionale e sintassi incompleta', () => {
    expect(parseUiCommand("Mi sento un po' triste")).toEqual({ type: 'message' });
    expect(parseUiCommand('about my family')).toEqual({ type: 'message' });
    expect(parseUiCommand('MODE').type).toBe('invalid');
    expect(parseUiCommand('MODE unknown').type).toBe('invalid');
    expect(parseUiCommand('THEME UNKNOWN').type).toBe('invalid');
    expect(parseUiCommand('MOTION maybe').type).toBe('invalid');
    expect(parseUiCommand('TRACE').type).toBe('invalid');
    expect(parseUiCommand('DELETE').type).toBe('invalid');
    expect(parseUiCommand('   ')).toEqual({ type: 'message' });
  });
});
