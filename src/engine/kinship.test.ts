// D630 - KINSHIP. `Look at the top card of your library. If it shares a creature type with ~, you may reveal it. If you do,
// <body>.` - the look and the shared type are a price (`VerbPrice.revealTopShares`): the payer looks (shown to them alone),
// the prompt is raised only while the top card shares a creature type with the source (a changeling has every one), and
// paying reveals it to every seat. What is proven: the parse; a sharing top card asked and revealed, the body run; declining
// runs nothing and reveals to nobody else; a top card with no shared type is looked at and nothing is asked; a changeling
// shares; a pick other than the top card is refused.
import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const PAYLOAD = 'Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, you gain 4 life.';
const KIN = 'test-kinship';
const SCRIPT: CardScript = {
  oracleId: KIN,
  name: 'Testing Kinship',
  triggers: [
    {
      abilityId: 'a0',
      text: 'When this creature enters, look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, you gain 4 life.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
      label: () => 'Testing Kinship',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects(PAYLOAD, 'Testing Kinship'), []),
    },
  ],
};
const settle = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting !== null || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);

/** A Bears stamped with the kinship script enters with `onTop` put on top of p1's library first. */
function kin(onTop: string): { g: Game; top: InstanceId } {
  const g = startedGame({ players: 2, decks: [[BEARS, BEARS, 'Forest', 'Woodland Changeling', 'Razorclaw Bear'], [BEARS]], scripts: createRegistry([SCRIPT]) });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.stack.length === 0 && s.priority.awaiting === null, 60_000);
  const top = put(g, 'p1', onTop, 'hand');
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: top, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
  const id = put(g, 'p1', BEARS, 'hand');
  const inst = g.state.cards[id];
  if (inst) (inst as { oracleId: string }).oracleId = KIN;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  return { g, top };
}

describe('D630 - kinship', () => {
  test('the parse: the look and the shared type are the price; the body is the branch', () => {
    const e = vocabularyEffects(PAYLOAD, 'Testing Kinship');
    expect(e.map((x) => x.kind)).toEqual(['payOptional']);
    expect(e[0]?.pay?.verbs?.revealTopShares).toBe('creature');
    expect(e[0]?.pay?.ifPaid.map((x) => x.kind)).toEqual(['gainLife']);
  });

  test('a top card sharing a creature type: shown to the payer, asked, revealed to every seat, the body run', () => {
    const { g, top } = kin('Razorclaw Bear');
    expect(g.state.priority.awaiting?.kind).toBe('payMana');
    expect(g.state.cards[top]?.revealedTo).toEqual(['p1']);
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [] }));
    settle(g);
    expect([...(g.state.cards[top]?.revealedTo ?? [])].sort()).toEqual(['p1', 'p2']);
    expect(g.state.players.p1?.life).toBe(life0 + 4);
  });

  test('declined: nothing happens and nobody else sees it', () => {
    const { g, top } = kin('Razorclaw Bear');
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect(g.state.cards[top]?.revealedTo).toEqual(['p1']);
    expect(g.state.players.p1?.life).toBe(life0);
  });

  test('a top card with no shared type is looked at, and nothing is asked; a changeling shares', () => {
    const forest = kin('Forest');
    expect(forest.g.state.priority.awaiting).toBeNull();
    expect(forest.g.state.cards[forest.top]?.revealedTo).toEqual(['p1']);
    const changeling = kin('Woodland Changeling');
    expect(changeling.g.state.priority.awaiting?.kind).toBe('payMana');
  });

  test('a pick other than the top card is refused', () => {
    const { g, top } = kin('Razorclaw Bear');
    const other = Object.keys(g.state.cards).find((id) => id !== top) as InstanceId;
    expect(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [other] }).ok).toBe(false);
    expect(g.state.priority.awaiting?.kind, 'still asked').toBe('payMana');
  });
});
