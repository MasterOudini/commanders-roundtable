// D577 step 0 - a chosen mode's two-operand clause (a fight, a bite) shifts BOTH its target indices past the earlier
// modes' clauses. modalEffects shifted the subject only, so Dromoka's Command's fourth mode chosen after a targeted one
// read its own subject as the other and the creature fought itself. What is proven here: the reading (the fight's
// indices mode-relative, both shifted by modalEffects), the cast - a Hill Giant fights the Grizzly Bears (the Bears die,
// the Giant lives) - and the replay hash.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { modalEffects } from './modes';
import type { Game } from './game';

const LANDS = ['Forest', 'Forest', 'Plains', 'Plains'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };

describe('D577 - a chosen mode' + "'" + 's fight shifts both its targets', () => {
  test('the reading: the fight' + "'" + 's indices mode-relative, both shifted past the earlier chosen modes', () => {
    const face = faceNamed("Dromoka's Command");
    expect(face.effectMode).toBe('auto');
    const modal = face.modal;
    if (!modal) throw new Error('not modal');
    const fight = modal.modes[3]?.effects.find((e) => e.otherTargetIndex !== undefined);
    expect([fight?.targetIndex, fight?.otherTargetIndex], 'within its mode').toEqual([0, 1]);
    const chosen = modalEffects(modal, [1, 3]).find((e) => e.otherTargetIndex !== undefined);
    expect([chosen?.targetIndex, chosen?.otherTargetIndex], 'after the sacrifice mode' + "'" + 's one target').toEqual([1, 2]);
  });

  test('Dromoka' + "'" + 's Command, the sacrifice and the fight: the Giant fights the Bears, not itself', () => {
    const g = startedGame({ players: 2, decks: [["Dromoka's Command", 'Hill Giant', ...LANDS], ['Grizzly Bears', ...LANDS]] });
    holdEverywhere(g);
    const cmd = put(g, 'p1', "Dromoka's Command", 'hand');
    const giant = put(g, 'p1', 'Hill Giant', 'battlefield');
    const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    main3(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: cmd, modes: [1, 3], targets: [{ kind: 'player', id: 'p2' }, { kind: 'card', id: giant }, { kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'the Giant' + "'" + 's 3 damage').toBe('graveyard');
    expect(g.state.cards[giant]?.zone.kind, 'the Bears' + "'" + ' 2 damage, not its own 3').toBe('battlefield');
    expect(g.state.cards[giant]?.damage).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
