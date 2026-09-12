// D413 - "IF IT WOULD DIE THIS TURN, EXILE IT INSTEAD" (CR 614.1): a mark on the creature the sentence
// names - the target, what the resolution damaged, or the board - riding the until-end-of-turn entry, read
// by the replacement funnel on the move to a graveyard: the creature goes to exile instead, this turn only.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
const SCRIPTS = createRegistry([...SHIPPED_SCRIPTS]);
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
function armed(decks: readonly (readonly string[])[]): Game {
  const g = startedGame({ players: 2, decks, scripts: SCRIPTS });
  holdEverywhere(g);
  settle(g);
  const t0 = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}
const marked = (g: Game, id: InstanceId) => g.state.untilEndOfTurn.some((e) => e.card === id && e.exileIfDies === true);
function cast(g: Game, name: string, targets: InstanceId[] = []): InstanceId {
  const card = put(g, 'p1', name, 'hand');
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: targets.map((id) => ({ kind: 'card' as const, id })) }));
  settle(g);
  return card;
}

describe('exile instead of dying (D413)', () => {
  test('Lava Coil: the faces read; the Cyclops goes to exile, not the graveyard; a survivor is marked and dies into exile later this turn, and not the turn after; the replay hash', () => {
    for (const n of ['Lava Coil', 'Malicious Malfunction', 'Malicious Eclipse', 'Anger of the Gods', 'Scorching Dragonfire']) {
      const f = ORACLE.byName(n)?.faces[0];
      expect(f?.effectMode, n).toBe('auto');
      expect(f?.effects.some((e) => e.kind === 'exileIfDies'), n + ' carries the rider').toBe(true);
    }
    const g = armed([['Lava Coil', 'Lava Coil', 'Lightning Bolt', 'Lightning Bolt'], ['Cyclops of One-Eyed Pass', 'Colossal Dreadmaw']]);
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
    settle(g);
    mana(g, 'R', 2);
    cast(g, 'Lava Coil', [cyclops]);
    expect(g.state.cards[cyclops]?.zone.kind, 'exiled instead of dying').toBe('exile');
    expect(g.log.some((e) => e.body.t === 'Narrated' && /exiled instead of dying/.test(e.body.text))).toBe(true);
    mana(g, 'R', 2);
    cast(g, 'Lava Coil', [dreadmaw]);
    expect(g.state.cards[dreadmaw]?.zone.kind, 'a 6/6 survives 4').toBe('battlefield');
    expect(marked(g, dreadmaw), 'but carries the mark').toBe(true);
    mana(g, 'R', 1);
    cast(g, 'Lightning Bolt', [dreadmaw]);
    expect(g.state.cards[dreadmaw]?.zone.kind, 'lethal later this turn: exiled').toBe('exile');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the mark ends at cleanup: a creature marked this turn dies to the graveyard next turn', () => {
    const g = armed([['Lava Coil', 'Lightning Bolt'], ['Colossal Dreadmaw']]);
    const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
    settle(g);
    mana(g, 'R', 2);
    cast(g, 'Lava Coil', [dreadmaw]);
    expect(marked(g, dreadmaw)).toBe(true);
    const t = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
    expect(marked(g, dreadmaw), 'cleared at cleanup').toBe(false);
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: dreadmaw, kind: '-1/-1', delta: 3 }));
    mana(g, 'R', 1);
    cast(g, 'Lightning Bolt', [dreadmaw]);
    expect(g.state.cards[dreadmaw]?.zone.kind, 'a plain death').toBe('graveyard');
  });

  test('Anger of the Gods marks what it damaged; Malicious Malfunction marks the board', () => {
    const g = armed([['Anger of the Gods', 'Malicious Malfunction'], ['Grizzly Bears', 'Colossal Dreadmaw', 'Coral Eel']]);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
    settle(g);
    mana(g, 'R', 3);
    cast(g, 'Anger of the Gods');
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect(marked(g, dreadmaw), 'damaged and alive: marked').toBe(true);
    const eel = put(g, 'p2', 'Coral Eel');
    settle(g);
    mana(g, 'B', 3);
    cast(g, 'Malicious Malfunction');
    expect(g.state.cards[eel]?.zone.kind, 'the 1/1 died to -2/-2 and was marked by the board form').toBe('exile');
  });
});
