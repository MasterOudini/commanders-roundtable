// `Barrin, Master Wizard` — "{2}, Sacrifice a permanent: Return target
// creature to its owner's hand." The chooser's EMPTY predicate (Claws of
// Gix's) driving a bounce: the card goes to its OWNER's hand (CR 108.4),
// whoever controls it now. M6.4l, D169.

import { BARRIN_MASTER_WIZARD } from '../../../data/fixtures/engineCards';
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
  BARRIN_MASTER_WIZARD,
  "{2}, Sacrifice a permanent: Return target creature to its owner's hand.",
);

export const BARRIN_MASTER_WIZARD_SCRIPT: CardScript = {
  oracleId: BARRIN_MASTER_WIZARD.oracleId,
  name: BARRIN_MASTER_WIZARD.name,
  activated: [
    {
      ref: `${BARRIN_MASTER_WIZARD.oracleId}#a0`,
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
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
