// `Army Ants` — "{T}, Sacrifice a land: Destroy target land." A land pays and
// a land dies: the chooser cost plus Angel of Despair's destroy discipline —
// indestructible is asked of the DERIVED target, and an indestructible target
// simply survives while the cost stays spent (the no-refund rule, D162's
// shape). M6.4l, D169.

import { ARMY_ANTS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ARMY_ANTS, '{T}, Sacrifice a land: Destroy target land.');

export const ARMY_ANTS_SCRIPT: CardScript = {
  oracleId: ARMY_ANTS.oracleId,
  name: ARMY_ANTS.name,
  activated: [
    {
      ref: `${ARMY_ANTS.oracleId}#a0`,
      text: TEXT,
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
