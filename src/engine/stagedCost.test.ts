// D535 - A STAGED CAST KEEPS PAYING WHAT IT CHOSE. A cast named without its targets stops at the targets stage, and the
// targets reprice the problem (the ward, CR 601.2c before 601.2f). That repricing started from the face's PRINTED mana
// cost whatever the cast was paying, so Grasp of Phantoms cast from the graveyard with no target named went on the stack
// for {3}{U}, not its {7}{U} flashback - the fuzz driver casts every spell that way. D437 had fixed the X stage for
// flashback alone; both stages now ask `stagedCastCost` for the cost `prepareCast` charged.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import type { Game } from './game';

const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, sym: 'U' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));

describe('D535 - the staged cast keeps its cost', () => {
  test('a flashback cast aimed at the targets stage still costs its flashback cost', () => {
    const g = startedGame({ players: 2, decks: [['Grasp of Phantoms', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const grasp = put(g, 'p1', 'Grasp of Phantoms', 'graveyard');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main3(g);
    // {3}{U} in the pool: the printed cost, not the flashback's {7}{U}.
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: grasp }));
    expect(g.state.pendingCast?.stage).toBe('targets');
    expect(g.state.pendingCast?.problem.totalMana).toBe(8);
    const short = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    expect(short.ok, 'the targets do not reprice the flashback down to the printed cost').toBe(false);
    expect(g.state.cards[grasp]?.zone.kind).toBe('stack');
    // Four more: the flashback cost is paid, the Bears goes on top of its library, the card to exile.
    mana(g, 'C', 4);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    const chosen = g.log.filter((e) => e.body.t === 'TargetsChosen').at(-1);
    expect(chosen?.body.t === 'TargetsChosen' ? chosen.body.problem.totalMana : null).toBe(8);
    advanceUntil(g, (s) => s.stack.length === 0 && s.priority.awaiting === null && s.pendingCast === null, 20_000);
    expect(g.state.cards[bears]?.zone.kind).toBe('library');
    expect(g.state.cards[grasp]?.zone.kind).toBe('exile');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
