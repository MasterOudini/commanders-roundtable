// The keyword target qualifier (D289): "target creature with flying" is a
// structured restriction the parser reads, the validator enforces on DERIVED
// keywords, and the effect parser may therefore admit.

import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from '../data/targetParse';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { createRegistry } from './scripts/registry';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears'; // no keywords
const HAWK = 'Vampire Nighthawk'; // flying, deathtouch, lifelink

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('the keyword qualifier is READ (D289)', () => {
  test('"with flying" is a structured restriction and the clause text quotes it', () => {
    const [spec] = parseTargetClauses('Destroy target creature with flying.');
    expect(spec?.kinds).toEqual(['creature']);
    expect(spec?.keyword).toEqual({ word: 'flying', present: true });
    expect(spec?.text).toBe('target creature with flying');
    expect(spec?.unenforced).toEqual([]);
  });

  test('"without flying" reads present: false', () => {
    const [spec] = parseTargetClauses('Destroy target creature without flying.');
    expect(spec?.keyword).toEqual({ word: 'flying', present: false });
    expect(spec?.text).toBe('target creature without flying');
  });

  test('two-word keywords map to the derived spelling', () => {
    const [spec] = parseTargetClauses('Destroy target creature with first strike.');
    expect(spec?.keyword).toEqual({ word: 'firstStrike', present: true });
  });

  test('"with flying you control" keeps the controller too', () => {
    const [spec] = parseTargetClauses('Tap target creature with flying you control.');
    expect(spec?.keyword).toEqual({ word: 'flying', present: true });
    expect(spec?.controller).toBe('you');
    expect(spec?.text).toBe('target creature with flying you control');
  });

  test('the numeric reader is untouched, in either order', () => {
    const [spec] = parseTargetClauses('Destroy target creature with power 4 or greater.');
    expect(spec?.keyword).toBeNull();
    expect(spec?.numeric).toEqual({ attr: 'power', cmp: 'atLeast', value: 4 });
  });

  test('a word the engine does not derive, or a list, is left alone (no narrowing on a guess)', () => {
    const [counter] = parseTargetClauses('Destroy target creature with a +1/+1 counter on it.');
    expect(counter?.keyword).toBeNull();
    const [list] = parseTargetClauses('Destroy target creature with flying or reach.');
    expect(list?.keyword).toBeNull();
    expect(list?.text).toBe('target creature');
  });

  test('effectParse admits the sentence only now that the restriction is enforced', () => {
    expect(parseEffects('Destroy target creature with flying.', 'Plummet', true).mode).toBe('auto');
    expect(parseEffects('Roast deals 5 damage to target creature without flying.', 'Roast', true).mode).toBe('auto');
    expect(parseEffects('Destroy target creature with flying or reach.', 'x', true).mode).not.toBe('auto');
  });
});

function armed(spell: string, colour: 'G' | 'B' | 'R', generic: number): { g: Game; bears: InstanceId; hawk: InstanceId; card: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[spell], [BEARS, HAWK]],
    scripts: createRegistry([]),
  });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS);
  const hawk = put(g, 'p2', HAWK);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const card = put(g, 'p1', spell, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: colour, amount: 1 }));
  if (generic > 0) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: generic }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears, hawk, card };
}

describe('the keyword qualifier is ENFORCED and the spell runs on its own (D289)', () => {
  test('Plummet refuses a ground creature and destroys a flyer, with no script at all', () => {
    const { g, bears, hawk } = armed('Plummet', 'G', 1);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[hawk]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('Defenestrate is the mirror: the flyer is refused, the ground creature dies', () => {
    const { g, bears, hawk } = armed('Defenestrate', 'B', 2);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[hawk]?.zone.kind).toBe('battlefield');
  });

  test('Roast deals its 5 to a ground creature and refuses the flyer', () => {
    const { g, bears, hawk } = armed('Roast', 'R', 1);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
  });
});
