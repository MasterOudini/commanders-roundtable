// `Goldmaw Champion` - an activation tapTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOLDMAW_CHAMPION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOLDMAW_CHAMPION, "Boast — {1}{W}: Tap target creature. (Activate only if this creature attacked this turn and only once each turn.)");

export const GOLDMAW_CHAMPION_SCRIPT: CardScript = {
  oracleId: GOLDMAW_CHAMPION.oracleId,
  name: GOLDMAW_CHAMPION.name,
  activated: [
    {
      ref: `${GOLDMAW_CHAMPION.oracleId}#a0`,
      text: PRINTED,
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
