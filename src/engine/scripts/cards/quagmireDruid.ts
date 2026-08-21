// `Quagmire Druid` — "{G}, {T}, Sacrifice a creature: Destroy target
// enchantment." The chooser paying an enchantment kill through the
// staged chain. D236.

import { QUAGMIRE_DRUID } from '../../../data/fixtures/engineCards';
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
  QUAGMIRE_DRUID,
  '{G}, {T}, Sacrifice a creature: Destroy target enchantment.',
);

export const QUAGMIRE_DRUID_SCRIPT: CardScript = {
  oracleId: QUAGMIRE_DRUID.oracleId,
  name: QUAGMIRE_DRUID.name,
  activated: [
    {
      ref: `${QUAGMIRE_DRUID.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
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
