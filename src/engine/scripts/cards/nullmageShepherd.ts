// `Nullmage Shepherd` — tapping four untapped creatures I control (the D286
// tap chooser, count four) destroys a target artifact or enchantment.

import { NULLMAGE_SHEPHERD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(NULLMAGE_SHEPHERD, 'Tap four untapped creatures you control: Destroy target artifact or enchantment.');

export const NULLMAGE_SHEPHERD_SCRIPT: CardScript = {
  oracleId: NULLMAGE_SHEPHERD.oracleId,
  name: NULLMAGE_SHEPHERD.name,
  activated: [
    {
      ref: `${NULLMAGE_SHEPHERD.oracleId}#a0`,
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
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
