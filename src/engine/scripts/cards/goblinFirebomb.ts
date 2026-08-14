// `Goblin Firebomb` — "{7}, {T}, Sacrifice this artifact: Destroy target
// permanent." Ark of Blight's targeted self-sacrifice with the widest spec
// (any permanent); line 1 is Flash (Tier 2, cast timing). M6.4u, D177.

import { GOBLIN_FIREBOMB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_FIREBOMB, 'Flash\n{7}, {T}, Sacrifice this artifact: Destroy target permanent.');
const TEXT = PRINTED.split('\n')[1] as string;

export const GOBLIN_FIREBOMB_SCRIPT: CardScript = {
  oracleId: GOBLIN_FIREBOMB.oracleId,
  name: GOBLIN_FIREBOMB.name,
  activated: [
    {
      // The Flash line has no colon, so the destroy is activated index 0.
      ref: `${GOBLIN_FIREBOMB.oracleId}#a0`,
      text: TEXT,
      // The Firebomb is already in the graveyard when this runs (D159), so
      // nothing here may ask about `self`'s position.
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b — an indestructible permanent is not destroyed.
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
