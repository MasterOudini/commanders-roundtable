// D487 - THE SPELL COPY (CR 707.10). `Copy target instant or sorcery spell. You may choose new targets for the copy.`:
// the copying clause puts a NEW STACK OBJECT on top of the stack with the copied spell's copiable values - no card
// (`card` is null, `source` the copied spell's card), the printing and face read off `copyOf` at resolution, the
// targets the original's - and, where the clause says so, asks its controller for new targets once the copy exists
// (`chooseTargets` with `forKind: 'copy'`; the empty answer keeps them). A copy resolves as the spell would and then
// ceases to exist. What is proven here: the parser's readings and refusals; Reverberate copying an opponent's Bolt and
// aiming the copy back at them (both resolve, each for three); the empty answer (the copy keeps its target); Fork's
// copy is red; Twincast copying the copy (a copy's own printing); a copy whose target has gone fizzles; the replay
// hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { StackId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? -1;
const asked = (g: Game) => { advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000); const a = g.state.priority.awaiting; if (a?.kind !== 'chooseTargets') throw new Error('no targets prompt'); return a; };
const top = (g: Game) => g.state.stack[g.state.stack.length - 1]?.id as StackId;
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };

/** p2 casts a Lightning Bolt at p1 during p1's third main phase; p1 then holds priority with the Bolt on the stack. */
function boltFromP2(g: Game): { bolt: StackId } {
  const bolt = put(g, 'p2', 'Lightning Bolt', 'hand');
  main3(g);
  must(g.submit({ t: 'PassPriority', player: 'p1' }));
  expect(g.state.priority.player).toBe('p2');
  mana(g, 'p2', 'R');
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'player', id: 'p1' }] }));
  must(g.submit({ t: 'PassPriority', player: 'p2' }));
  expect(g.state.priority.player, 'p1 answers with the Bolt on the stack').toBe('p1');
  return { bolt: top(g) };
}

describe('D487 - the spell copy', () => {
  test('the parser reads the forms, the colour exception, and refuses a permanent spell', () => {
    const rev = faceNamed('Reverberate');
    expect(rev.effectMode).toBe('auto');
    expect(rev.effects).toHaveLength(1);
    expect(rev.effects[0]).toMatchObject({ kind: 'copySpell', newTargets: true, copy: { of: 'target', exceptions: null } });
    expect(rev.targets).toHaveLength(1);
    const fork = faceNamed('Fork');
    expect(fork.effectMode).toBe('auto');
    expect(fork.effects[0]).toMatchObject({ kind: 'copySpell', newTargets: true, copy: { of: 'target', exceptions: { colors: ['R'] } } });
    expect(faceNamed('Twincast').effectMode).toBe('auto');
    const plain = parseEffects('Copy target instant or sorcery spell.', 'Test', true);
    expect(plain.mode).toBe('auto');
    expect(plain.effects[0]?.newTargets).toBeUndefined();
    expect(parseEffects('Copy target spell. You may choose new targets for the copy.', 'Test', true).mode).not.toBe('auto');
    expect(parseEffects('Copy target creature spell.', 'Test', true).mode).not.toBe('auto');
  });

  test('Reverberate copies an opponent Bolt and aims the copy back at them: both resolve', () => {
    const g = startedGame({ players: 2, decks: [['Reverberate', 'Grizzly Bears'], ['Lightning Bolt', 'Grizzly Bears']] });
    holdEverywhere(g);
    const rev = put(g, 'p1', 'Reverberate', 'hand');
    const { bolt } = boltFromP2(g);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: bolt }] }));
    const ask = asked(g);
    expect(ask.player).toBe('p1');
    expect(ask.forKind).toBe('copy');
    expect(ask.count).toBe(0);
    const copy = g.state.stack.find((o) => o.copyOf !== undefined);
    expect(copy).toBeDefined();
    expect(copy?.id).toBe(ask.stackId);
    expect(copy?.card).toBeNull();
    expect(copy?.controller).toBe('p1');
    expect(copy?.targets).toEqual([{ kind: 'player', id: 'p1' }]);
    expect(copy?.label).toBe('Lightning Bolt (copy)');
    expect(g.state.stack.map((o) => o.id), 'the copy sits on top of the original').toEqual([bolt, copy?.id]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(life(g, 'p2'), 'the copy, aimed at its caster').toBe(37);
    expect(life(g, 'p1'), 'the original still resolves').toBe(37);
    expect(g.log.filter((e) => e.body.t === 'SpellCopied')).toHaveLength(1);
    expect(g.state.stack).toHaveLength(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the empty answer keeps the original targets; an illegal new set is refused', () => {
    const g = startedGame({ players: 2, decks: [['Reverberate', 'Grizzly Bears'], ['Lightning Bolt', 'Grizzly Bears']] });
    holdEverywhere(g);
    const rev = put(g, 'p1', 'Reverberate', 'hand');
    const { bolt } = boltFromP2(g);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: bolt }] }));
    asked(g);
    expect(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [] }).ok, 'not p2 to aim').toBe(false);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: bolt }] }).ok, 'a Bolt cannot aim at a spell').toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(life(g, 'p1'), 'both aimed at p1').toBe(34);
    expect(life(g, 'p2')).toBe(40);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Fork makes a red copy', () => {
    const g = startedGame({ players: 2, decks: [['Fork', 'Grizzly Bears'], ['Lightning Bolt', 'Grizzly Bears']] });
    holdEverywhere(g);
    const fork = put(g, 'p1', 'Fork', 'hand');
    const { bolt } = boltFromP2(g);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: fork, targets: [{ kind: 'stack', id: bolt }] }));
    asked(g);
    const copy = g.state.stack.find((o) => o.copyOf !== undefined);
    expect(copy?.copyOf?.colors).toEqual(['R']);
    expect(copy?.identity).toEqual(['R']);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(life(g, 'p2')).toBe(37);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Twincast copies the copy: a copy has a printing of its own', () => {
    const g = startedGame({ players: 2, decks: [['Reverberate', 'Twincast', 'Grizzly Bears'], ['Lightning Bolt', 'Grizzly Bears']] });
    holdEverywhere(g);
    const rev = put(g, 'p1', 'Reverberate', 'hand');
    const twin = put(g, 'p1', 'Twincast', 'hand');
    const { bolt } = boltFromP2(g);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: bolt }] }));
    asked(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting === null && s.priority.player === 'p1', 20_000);
    const first = top(g);
    expect(g.state.stack.find((o) => o.id === first)?.copyOf).toBeDefined();
    mana(g, 'p1', 'UU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: twin, targets: [{ kind: 'stack', id: first }] }));
    const ask = asked(g);
    const second = g.state.stack.find((o) => o.id === ask.stackId);
    expect(second?.copyOf?.printingId).toBe(g.state.stack.find((o) => o.id === first)?.copyOf?.printingId);
    expect(second?.label).toBe('Lightning Bolt (copy) (copy)');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(life(g, 'p1'), 'the original and the first copy').toBe(34);
    expect(life(g, 'p2'), 'the second copy').toBe(37);
    expect(g.log.filter((e) => e.body.t === 'SpellCopied')).toHaveLength(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a copy whose target has gone fizzles, and nothing is left behind', () => {
    const g = startedGame({ players: 2, decks: [['Reverberate', 'Grizzly Bears'], ['Lightning Bolt', 'Grizzly Bears']] });
    holdEverywhere(g);
    const rev = put(g, 'p1', 'Reverberate', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const boltCard = put(g, 'p2', 'Lightning Bolt', 'hand');
    main3(g);
    must(g.submit({ t: 'PassPriority', player: 'p1' }));
    mana(g, 'p2', 'R');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: boltCard, targets: [{ kind: 'card', id: bears }] }));
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    const bolt = top(g);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: bolt }] }));
    const ask = asked(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting === null && s.priority.player === 'p1', 20_000);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'SpellFizzled' && e.body.stackId === ask.stackId), 'the copy fizzled').toBe(true);
    expect(g.state.stack).toHaveLength(0);
    expect(life(g, 'p1')).toBe(40);
    expect(g.state.cards[boltCard]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
