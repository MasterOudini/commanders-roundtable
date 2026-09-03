// `Hand of Justice` — its own tap and three untapped WHITE creatures I
// control tapped (the D286 tap chooser with a colour predicate) destroy a
// target creature.

import { HAND_OF_JUSTICE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HAND_OF_JUSTICE, '{T}, Tap three untapped white creatures you control: Destroy target creature.');

export const HAND_OF_JUSTICE_SCRIPT: CardScript = {
  oracleId: HAND_OF_JUSTICE.oracleId,
  name: HAND_OF_JUSTICE.name,
  activated: [
    {
      ref: `${HAND_OF_JUSTICE.oracleId}#a0`,
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
