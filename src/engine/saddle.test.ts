// D553 - SADDLE (CR 702.171a): "Saddle N" means "Tap any number of other untapped creatures you control with total
// power N or greater: This creature becomes saddled until end of turn. Activate only as a sorcery." Crew's shape (D311):
// the synthesized ability and its tap chooser, at sorcery speed, the `saddled` mark on the until-end-of-turn list
// (CR 702.171b). What is proven here: the reading (the ability, its power, sorcery-only; the Saddle line accounted);
// Seraphic Steed saddled by two Bears - the offer names the power and the candidates, the riders tapped, the mark on the
// Steed; too little power refused, the Steed never its own rider; not offered on the opponent's turn or over a spell on
// the stack; the mark gone at cleanup; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { linesUnaccounted } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const saddled = (g: Game, id: InstanceId) => g.state.untilEndOfTurn.some((m) => m.card === id && m.saddled === true);
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
function saddleIndex(g: Game, id: InstanceId): number {
  const d = deps(createRegistry([]));
  const inst = g.state.cards[id];
  const ability = (inst ? d.oracle.byPrinting(inst.printingId) : undefined)?.faces[0]?.activated.find((a) => a.saddle !== undefined);
  if (!ability) throw new Error('no saddle ability');
  return ability.index;
}
const offerOf = (g: Game, id: InstanceId) => {
  const d = deps(createRegistry([]));
  const a = legalActions(g.state, d.oracle, d.scripts, 'p1').find((x) => x.t === 'ActivateAbility' && x.card === id);
  return a?.t === 'ActivateAbility' ? a : undefined;
};

describe('D553 - saddle', () => {
  test('the reading: a synthesized ability with its power, sorcery-only; the Saddle line is the engine' + "'" + 's', () => {
    const d = deps(createRegistry([]));
    const steed = d.oracle.byName('Seraphic Steed')?.faces[0]?.activated.find((a) => a.saddle !== undefined);
    expect(steed?.saddle?.power).toBe(4);
    expect(steed?.sorceryOnly).toBe(true);
    expect(steed?.costText).toBe('Saddle 4');
    for (const name of ['Seraphic Steed', 'Gilded Ghoda']) {
      const card = fixture(name);
      const face = d.oracle.byName(name)?.faces[0];
      if (!face) throw new Error('no face ' + name);
      const open = linesUnaccounted(card.faces[0]?.oracleText ?? '', face, card.keywords).map((l) => l.text);
      expect(open.some((l) => /^Saddle/.test(l)), name + ': the Saddle line accounted').toBe(false);
    }
  });

  test('Seraphic Steed saddled by two Bears: the riders tapped, the Steed saddled until cleanup', () => {
    const g = startedGame({ players: 2, decks: [['Seraphic Steed', 'Grizzly Bears', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    const steed = put(g, 'p1', 'Seraphic Steed');
    const b1 = put(g, 'p1', 'Grizzly Bears');
    const b2 = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    main(g, 3);
    const offer = offerOf(g, steed);
    expect(offer?.tapPower).toBe(4);
    expect([...(offer?.tapCandidates ?? [])].sort()).toEqual([b1, b2].sort());
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: steed, abilityIndex: saddleIndex(g, steed), tap: [b1] }).ok, 'two power is not four').toBe(false);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: steed, abilityIndex: saddleIndex(g, steed), tap: [steed, b1] }).ok, 'never its own rider').toBe(false);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: steed, abilityIndex: saddleIndex(g, steed), tap: [b1, b2] }));
    settle(g);
    expect(saddled(g, steed)).toBe(true);
    expect([g.state.cards[b1]?.tapped, g.state.cards[b2]?.tapped, g.state.cards[steed]?.tapped]).toEqual([true, true, false]);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(saddled(g, steed), 'cleanup clears the mark').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('saddle is a sorcery: not on the opponent turn, not over a spell on the stack', () => {
    const g = startedGame({ players: 2, decks: [['Gilded Ghoda', 'Grizzly Bears', 'Lightning Bolt'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    const ghoda = put(g, 'p1', 'Gilded Ghoda');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null, 40_000);
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    expect(g.state.priority.player).toBe('p1');
    expect(offerOf(g, ghoda), 'not on the opponent turn').toBeUndefined();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: ghoda, abilityIndex: saddleIndex(g, ghoda), tap: [bears] }).ok).toBe(false);
    main(g, 5);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    expect(g.state.stack).toHaveLength(1);
    expect(offerOf(g, ghoda), 'not over a spell on the stack').toBeUndefined();
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ghoda, abilityIndex: saddleIndex(g, ghoda), tap: [bears] }));
    settle(g);
    expect(saddled(g, ghoda)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
