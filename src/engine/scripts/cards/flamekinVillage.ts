// `Flamekin Village` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLAMEKIN_VILLAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLAMEKIN_VILLAGE, "As this land enters, you may reveal an Elemental card from your hand. If you don't, this land enters tapped.\n{T}: Add {R}.\n{R}, {T}: Target creature gains haste until end of turn.");
const LINES = PRINTED.split('\n');

export const FLAMEKIN_VILLAGE_SCRIPT: CardScript = {
  oracleId: FLAMEKIN_VILLAGE.oracleId,
  name: FLAMEKIN_VILLAGE.name,
  activated: [
    {
      ref: `${FLAMEKIN_VILLAGE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["haste"] }];
      },
    },
  ],
};
