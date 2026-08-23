// `Voracious Varmint` — vigilance plus Viridian Zealot's self-sacrifice
// compound (D266), one mana cheaper. The keyword line never counts, so the
// ability is `#a0` and its text is `split[1]`. D267.

import { VORACIOUS_VARMINT } from '../../../data/fixtures/engineCards';
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
  VORACIOUS_VARMINT,
  'Vigilance\n{1}, Sacrifice this creature: Destroy target artifact or enchantment.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const VORACIOUS_VARMINT_SCRIPT: CardScript = {
  oracleId: VORACIOUS_VARMINT.oracleId,
  name: VORACIOUS_VARMINT.name,
  activated: [
    {
      ref: `${VORACIOUS_VARMINT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
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
