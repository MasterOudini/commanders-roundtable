// `Dispeller's Capsule` — "{2}{W}, {T}, Sacrifice this artifact: Destroy
// target artifact or enchantment." D159's self-sacrifice charging Angel of
// Despair's destroy — indestructible asked of the DERIVED target, and the
// Capsule stays spent either way (the no-refund rule, D162). M6.4o, D171.

import { DISPELLER_S_CAPSULE } from '../../../data/fixtures/engineCards';
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
  DISPELLER_S_CAPSULE,
  '{2}{W}, {T}, Sacrifice this artifact: Destroy target artifact or enchantment.',
);

export const DISPELLERS_CAPSULE_SCRIPT: CardScript = {
  oracleId: DISPELLER_S_CAPSULE.oracleId,
  name: DISPELLER_S_CAPSULE.name,
  activated: [
    {
      ref: `${DISPELLER_S_CAPSULE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b — an indestructible permanent is not destroyed. The event
        // simply does not happen; the ability still resolves.
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
