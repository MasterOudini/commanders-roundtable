// `Telemin Performance` — the reveal-until composed with a THEFT: the
// creature card arrives under MY control while the noncreatures above it go
// to their OWNER's graveyard.
//
// ⚠️ The library top is engineered rather than trusted: a padded deck is
// mostly basics and its one creature may well be in the opening seven, which
// would make the run's length luck (D232's shuffled-padded-30 trap).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TELEMIN_PERFORMANCE_SCRIPT } from './teleminPerformance';
import { TELEMIN_PERFORMANCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TELEMIN = 'Telemin Performance';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** `cover` noncreature cards are stacked ABOVE the creature. */
function performed(cover: number): { g: Game; bears: InstanceId; covered: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[TELEMIN], [BEARS]],
    scripts: createRegistry([TELEMIN_PERFORMANCE_SCRIPT]),
  });
  holdEverywhere(g);
  // The creature first, so the cover lands on top of it.
  const bears = put(g, 'p2', BEARS, 'graveyard');
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: bears,
      to: { kind: 'library', player: 'p2' },
      placement: 'top',
    }),
  );
  const covered: InstanceId[] = [];
  for (let i = 0; i < cover; i++) {
    const lib = g.state.zones.library['p2'] ?? [];
    const id = lib[0] as InstanceId; // the BOTTOM card — never the creature
    covered.push(id);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p2',
        card: id,
        to: { kind: 'library', player: 'p2' },
        placement: 'top',
      }),
    );
  }
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', TELEMIN, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, bears, covered };
}

describe('Telemin Performance', () => {
  test('the creature on top comes straight to MY battlefield', () => {
    const { g, bears } = performed(0);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.controller).toBe('p1');
    expect(g.state.cards[bears]?.owner).toBe('p2');
  });

  test('the noncreatures above it go to their OWNER\'s graveyard', () => {
    const { g, bears, covered } = performed(2);
    expect(covered).toHaveLength(2);
    for (const id of covered) {
      expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
      expect(g.state.cards[id]?.zone.player).toBe('p2');
    }
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.controller).toBe('p1');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TELEMIN_PERFORMANCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TELEMIN_PERFORMANCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TELEMIN_PERFORMANCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = performed(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
