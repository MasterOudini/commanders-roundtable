// `Necrogen Spellbomb` — "{B}, Sacrifice this artifact: Target player
// discards a card.\n{1}, Sacrifice this artifact: Draw a card." Aether
// Spellbomb's two self-sacrifice activations (D272) with Wistful Thinking's
// chooseFromZone ask (D270: raisable straight from a resolve) put to the
// TARGETED player for one card of their hand — an empty hand asks nothing.
// D278.

import { NECROGEN_SPELLBOMB } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(
  NECROGEN_SPELLBOMB,
  '{B}, Sacrifice this artifact: Target player discards a card.\n{1}, Sacrifice this artifact: Draw a card.',
);
const DISCARD = PRINTED.split('\n')[0] as string;
const DRAW = PRINTED.split('\n')[1] as string;

export const NECROGEN_SPELLBOMB_SCRIPT: CardScript = {
  oracleId: NECROGEN_SPELLBOMB.oracleId,
  name: NECROGEN_SPELLBOMB.name,
  activated: [
    {
      ref: `${NECROGEN_SPELLBOMB.oracleId}#a0`,
      text: DISCARD,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const victim = ctx.state.players[target.id];
        if (!victim || victim.hasLost) return [];
        const hand = ctx.state.zones.hand[target.id] ?? [];
        if (hand.length === 0) return [];
        return [
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'chooseFromZone',
              player: target.id,
              zone: 'hand',
              rest: null,
              count: 1,
              label: obj.label,
            },
          },
        ];
      },
    },
    {
      ref: `${NECROGEN_SPELLBOMB.oracleId}#a1`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
