// `Druid Lyrist` — "{G}, {T}, Sacrifice this creature: Destroy target
// enchantment." Dispeller's Capsule's self-sacrifice destroy one type over —
// indestructible asked of the DERIVED target, the Lyrist spent either way.
// M6.4p, D172.

import { DRUID_LYRIST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DRUID_LYRIST, '{G}, {T}, Sacrifice this creature: Destroy target enchantment.');

export const DRUID_LYRIST_SCRIPT: CardScript = {
  oracleId: DRUID_LYRIST.oracleId,
  name: DRUID_LYRIST.name,
  activated: [
    {
      ref: `${DRUID_LYRIST.oracleId}#a0`,
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
