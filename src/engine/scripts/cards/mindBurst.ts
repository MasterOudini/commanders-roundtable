// `Mind Burst` — "Target player discards X cards, where X is one plus the
// number of cards named Mind Burst in all graveyards." The Frantic
// Inventory name census feeding Laquatus's discard ask — with D137's
// no-choice rule in the resolve: a hand no bigger than the count goes
// whole, choicelessly, and only a REAL choice raises the prompt. D225.

import { MIND_BURST } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const TEXT = printed(
  MIND_BURST,
  'Target player discards X cards, where X is one plus the number of cards named Mind Burst in all graveyards.',
);

export const MIND_BURST_SCRIPT: CardScript = {
  oracleId: MIND_BURST.oracleId,
  name: MIND_BURST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      let named = 0;
      for (const seat of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[seat] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card && ctx.oracle.byPrinting(card.printingId);
          if (oc && faceOf(oc, card.faceIndex ?? 0).name === 'Mind Burst') named++;
        }
      }
      const count = 1 + named;
      const hand = ctx.state.zones.hand[target.id] ?? [];
      if (hand.length === 0) return [];
      if (hand.length <= count) {
        // No choice to make (CR 701.8a) — the whole hand goes.
        return [
          {
            t: 'CardsMoved',
            moves: hand.map((id) => ({
              card: id,
              from: { kind: 'hand' as const, player: target.id },
              to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? target.id },
            })),
          },
        ];
      }
      return [
        {
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: target.id,
            zone: 'hand',
            rest: null,
            count,
            label: obj.label,
          },
        },
      ];
    },
  },
};
