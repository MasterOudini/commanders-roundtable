// `Anchor to the Aether` — the target goes on TOP of its owner's library,
// then the caster scries THEIR OWN top: two libraries, one resolve.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ANCHOR_TO_THE_AETHER_SCRIPT } from './anchorToTheAether';
import { ANCHOR_TO_THE_AETHER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; theirs: InstanceId; revealed: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Anchor to the Aether', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ANCHOR_TO_THE_AETHER_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Anchor to the Aether', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
  return { g, theirs, revealed };
}

describe('Anchor to the Aether', () => {
  test('the creature tops ITS OWNER\'S library while the CASTER scries their own', () => {
    const { g, theirs, revealed } = cast();
    const theirLib = g.state.zones.library['p2'] ?? [];
    expect(theirLib[theirLib.length - 1]).toBe(theirs);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [revealed] }));
    settle(g);
    expect(g.state.zones.library['p1']?.[0]).toBe(revealed);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ANCHOR_TO_THE_AETHER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ANCHOR_TO_THE_AETHER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ANCHOR_TO_THE_AETHER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = cast();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [revealed], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
