// `Wanderbrine Trapper` — one mana, its own tap and ANOTHER untapped creature
// of mine tapped (the D286 tap chooser with `another`) tap a creature an
// opponent controls.

import { WANDERBRINE_TRAPPER } from '../../../data/fixtures/engineCards';
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
  WANDERBRINE_TRAPPER,
  '{1}, {T}, Tap another untapped creature you control: Tap target creature an opponent controls.',
);

export const WANDERBRINE_TRAPPER_SCRIPT: CardScript = {
  oracleId: WANDERBRINE_TRAPPER.oracleId,
  name: WANDERBRINE_TRAPPER.name,
  activated: [
    {
      ref: `${WANDERBRINE_TRAPPER.oracleId}#a0`,
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
