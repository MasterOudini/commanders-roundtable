// `Aether Spellbomb` — "{U}, Sacrifice this artifact: Return target creature
// to its owner's hand.\n{1}, Sacrifice this artifact: Draw a card." Two
// self-sacrifice activations on one artifact: the bounce aims at ANY creature
// and sends it to its OWNER's hand; the draw is the Cluestone shape (D163).
// Either sacrifice is charged at activation (D159), so both resolves run with
// the Spellbomb already in the graveyard and read `obj.controller`. D272.

import { AETHER_SPELLBOMB } from '../../../data/fixtures/engineCards';
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
  AETHER_SPELLBOMB,
  "{U}, Sacrifice this artifact: Return target creature to its owner's hand.\n{1}, Sacrifice this artifact: Draw a card.",
);
const BOUNCE = PRINTED.split('\n')[0] as string;
const DRAW = PRINTED.split('\n')[1] as string;

export const AETHER_SPELLBOMB_SCRIPT: CardScript = {
  oracleId: AETHER_SPELLBOMB.oracleId,
  name: AETHER_SPELLBOMB.name,
  activated: [
    {
      ref: `${AETHER_SPELLBOMB.oracleId}#a0`,
      text: BOUNCE,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
    {
      ref: `${AETHER_SPELLBOMB.oracleId}#a1`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
