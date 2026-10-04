// D618 - THE SELF-EXILE COST: `Exile this artifact` (from the battlefield) is the self-sacrifice's deterministic price with
// exile for the graveyard (CR 602.2) - read as `exilesSelf`, charged as the ability is activated, and behind the same def
// gate (D159): offered only when a def will run the effect. What is proven: the read (and D329's graveyard form left as it
// was); the gate without a def; the charge with one - Relic of Progenitus exiled, the graveyards exiled, a card drawn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, fullControl, must, ORACLE, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const RELIC = 'Relic of Progenitus';
const CANE = "Feldon's Cane";
const DECK = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', RELIC];

function relicIndex(): number {
  const i = ORACLE.byName(RELIC)?.faces[0]?.activated.findIndex((a) => a.exilesSelf === true) ?? -1;
  if (i < 0) throw new Error('no self-exile ability read on ' + RELIC);
  return i;
}

/** Relic of Progenitus' `{1}, Exile this artifact: Exile all graveyards. Draw a card.`, through the vocabulary. */
function relicDef(): CardScript {
  const card = ORACLE.byName(RELIC);
  if (!card) throw new Error('no fixture');
  const payload = 'Exile all graveyards. Draw a card.';
  const effects = vocabularyEffects(payload, RELIC);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: RELIC,
    activated: [{ ref: card.oracleId + '#a' + relicIndex(), text: card.faces[0]?.oracleText ?? '', ...(targets.length > 0 ? { targets } : {}), resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets) }],
  };
}

function bury(g: Game, player: 'p1' | 'p2'): InstanceId {
  const top = (g.state.zones.library[player] ?? [])[0];
  if (!top) throw new Error('an empty library');
  must(g.submit({ t: 'ManualMoveCard', player, card: top, to: { kind: 'graveyard', player } }));
  return top;
}

describe('the self-exile cost (D618)', () => {
  test('the read: the battlefield form is exilesSelf, payable; the graveyard form is not', () => {
    const relic = ORACLE.byName(RELIC)?.faces[0]?.activated[relicIndex()];
    expect(relic?.exilesSelf).toBe(true);
    expect(relic?.payable).toBe(true);
    expect(relic?.sacrificesSelf).toBe(false);
    const cane = ORACLE.byName(CANE)?.faces[0]?.activated[0];
    expect(cane?.exilesSelf).toBe(true);
    expect(cane?.requiresTap).toBe(true);
    expect(cane?.exileSelfFromGraveyard).toBe(false);
  });

  test('no def, no offer and no charge - the permanent is not eaten for nothing (D159)', () => {
    const g = startedGame({ decks: [DECK, ['Forest', 'Forest']], scripts: createRegistry([]) });
    fullControl(g, 'p1');
    const id = put(g, 'p1', RELIC);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const offered = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').some((a) => a.t === 'ActivateAbility' && a.card === id && a.abilityIndex === relicIndex());
    expect(offered).toBe(false);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: relicIndex() }).ok).toBe(false);
    expect(g.state.cards[id]?.zone.kind).toBe('battlefield');
  });

  test('with the def: the cost exiles the Relic, the effect exiles the graveyards and draws', () => {
    const g = startedGame({ decks: [DECK, ['Forest', 'Forest', 'Forest']], scripts: createRegistry([relicDef()]) });
    fullControl(g, 'p1');
    const id = put(g, 'p1', RELIC);
    const mine = bury(g, 'p1');
    const theirs = bury(g, 'p2');
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    expect(legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').some((a) => a.t === 'ActivateAbility' && a.card === id && a.abilityIndex === relicIndex())).toBe(true);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: relicIndex() }));
    expect(g.state.cards[id]?.zone.kind, 'the cost is paid as the ability is activated').toBe('exile');
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 400);
    expect(g.state.cards[mine]?.zone.kind).toBe('exile');
    expect(g.state.cards[theirs]?.zone.kind).toBe('exile');
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
