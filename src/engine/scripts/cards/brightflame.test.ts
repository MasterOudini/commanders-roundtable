// `Brightflame` — the radiance set: X hits the green target AND its green
// kin, spares the red bystander, and the caster gains X per creature hit.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BRIGHTFLAME_SCRIPT } from './brightflame';
import { BRIGHTFLAME } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flamed(): { g: Game; a: InstanceId; kin: InstanceId; red: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Brightflame'], ['Grizzly Bears', 'Grizzly Bears', 'Bloodlust Inciter']],
    scripts: createRegistry([BRIGHTFLAME_SCRIPT]),
  });
  const a = put(g, 'p2', 'Grizzly Bears');
  const kin = put(g, 'p2', 'Grizzly Bears');
  const red = put(g, 'p2', 'Bloodlust Inciter');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Brightflame', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
  settle(g);
  return { g, a, kin, red };
}

describe('Brightflame', () => {
  test('X=2 kills BOTH green Bears, spares the red one, gains 4', () => {
    const { g, a, kin, red } = flamed();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[kin]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[red]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BRIGHTFLAME.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BRIGHTFLAME.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BRIGHTFLAME.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flamed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
