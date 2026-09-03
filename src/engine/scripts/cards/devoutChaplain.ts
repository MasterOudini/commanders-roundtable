// `Devout Chaplain` — its own tap and two untapped Humans I control tapped
// (the D286 tap chooser) exile a target artifact or enchantment.

import { DEVOUT_CHAPLAIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DEVOUT_CHAPLAIN, '{T}, Tap two untapped Humans you control: Exile target artifact or enchantment.');

export const DEVOUT_CHAPLAIN_SCRIPT: CardScript = {
  oracleId: DEVOUT_CHAPLAIN.oracleId,
  name: DEVOUT_CHAPLAIN.name,
  activated: [
    {
      ref: `${DEVOUT_CHAPLAIN.oracleId}#a0`,
      text: TEXT,
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
                to: { kind: 'exile', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
