// `Rush of Blood` — "Target creature gets +X/+0 until end of turn, where
// X is its power." Double Trouble's doubling on a single target. D242.

import { RUSH_OF_BLOOD } from '../../../data/fixtures/engineCards';
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
  RUSH_OF_BLOOD,
  'Target creature gets +X/+0 until end of turn, where X is its power.',
);

export const RUSH_OF_BLOOD_SCRIPT: CardScript = {
  oracleId: RUSH_OF_BLOOD.oracleId,
  name: RUSH_OF_BLOOD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const power = ctx.derive(target.id).power ?? 0;
      if (power <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power, toughness: 0 }];
    },
  },
};
