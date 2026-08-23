// `Unleash Fury` — DOUBLE the power: the pump is +derivedPower, read at
// resolution, so a 2/2 becomes 4/2 and a creature already pumped to 3 becomes
// 6/2. Toughness is untouched. A power of 0 or less doubles to nothing, which
// is a true no-op rather than a negative pump. D264.

import { UNLEASH_FURY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(UNLEASH_FURY, 'Double the power of target creature until end of turn.');

export const UNLEASH_FURY_SCRIPT: CardScript = {
  oracleId: UNLEASH_FURY.oracleId,
  name: UNLEASH_FURY.name,
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
