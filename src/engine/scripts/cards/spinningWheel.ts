// `Spinning Wheel` — "{5}, {T}: Tap target creature." The tap-target at #a1
// behind an any-color mana line the engine parses. D251.

import { SPINNING_WHEEL } from '../../../data/fixtures/engineCards';
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
  SPINNING_WHEEL,
  '{T}: Add one mana of any color.\n{5}, {T}: Tap target creature.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SPINNING_WHEEL_SCRIPT: CardScript = {
  oracleId: SPINNING_WHEEL.oracleId,
  name: SPINNING_WHEEL.name,
  activated: [
    {
      ref: `${SPINNING_WHEEL.oracleId}#a1`,
      text: TEXT,
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
