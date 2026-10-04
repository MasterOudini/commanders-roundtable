// `Giant Killer // Chop Down` - an activation tapTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIANT_KILLER_CHOP_DOWN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(GIANT_KILLER_CHOP_DOWN, "{1}{W}, {T}: Tap target creature.\nDestroy target creature with power 4 or greater. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const GIANT_KILLER_CHOP_DOWN_SCRIPT: CardScript = {
  oracleId: GIANT_KILLER_CHOP_DOWN.oracleId,
  name: GIANT_KILLER_CHOP_DOWN.name,
  activated: [
    {
      ref: `${GIANT_KILLER_CHOP_DOWN.oracleId}#a0`, face: 0,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
