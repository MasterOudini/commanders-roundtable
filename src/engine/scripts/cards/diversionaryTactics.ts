// `Diversionary Tactics` — tapping two untapped creatures I control (the
// D286 tap chooser, count two) taps a target creature.

import { DIVERSIONARY_TACTICS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DIVERSIONARY_TACTICS, 'Tap two untapped creatures you control: Tap target creature.');

export const DIVERSIONARY_TACTICS_SCRIPT: CardScript = {
  oracleId: DIVERSIONARY_TACTICS.oracleId,
  name: DIVERSIONARY_TACTICS.name,
  activated: [
    {
      ref: `${DIVERSIONARY_TACTICS.oracleId}#a0`,
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
