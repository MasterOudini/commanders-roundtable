// `Revelsong Horn` — one mana, the Horn's tap and an untapped creature of
// mine tapped (the D286 tap chooser) give a creature +1/+1 until cleanup.

import { REVELSONG_HORN } from '../../../data/fixtures/engineCards';
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
  REVELSONG_HORN,
  '{1}, {T}, Tap an untapped creature you control: Target creature gets +1/+1 until end of turn.',
);

export const REVELSONG_HORN_SCRIPT: CardScript = {
  oracleId: REVELSONG_HORN.oracleId,
  name: REVELSONG_HORN.name,
  activated: [
    {
      ref: `${REVELSONG_HORN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1, keywords: [] }];
      },
    },
  ],
};
