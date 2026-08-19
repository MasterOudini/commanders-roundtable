// `Char` — the first targeted SpellDef: 4 to the target, 2 to the caster,
// through the seam that outranks the vocabulary. Also pins BOTH halves of
// the assisted-offer suppression predicate (client.assistedEffectsFor):
// Char's face still parses `assisted`, and the registry carries its spell
// def — without the client's check the parsed half would be offered AGAIN.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CHAR_SCRIPT } from './char';
import { CHAR } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; char: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Char'], ['Grizzly Bears']],
    scripts: createRegistry([CHAR_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const char = put(g, 'p1', 'Char', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: char }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, char, theirs };
}

describe('Char', () => {
  test('4 kills the Bears through the SBA, 2 comes back at the caster', () => {
    const { g, char, theirs } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.cards[char]?.zone.kind).toBe('graveyard');
  });

  test('a player target takes 4 while the caster still takes 2', () => {
    const { g } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(36);
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('the suppression predicate holds: the vocabulary does NOT fully read Char, the def does', () => {
    // `client.assistedEffectsFor` suppresses the offer exactly when a SHIPPED
    // spell def exists — this pins both inputs: the parser must not claim the
    // whole card (if a vocabulary widening ever flips Char to `auto`, the def
    // and the vocabulary would BOTH want to run and this fails by name), and
    // the registry must actually carry the def (a dropped registration turns
    // the suppression into a silent nothing).
    const text = CHAR.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CHAR.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CHAR.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, theirs } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
