// `Dromoka Dunecaster` — {1}{W}, {T}: tap a creature WITHOUT flying (D289).

import { DROMOKA_DUNECASTER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DROMOKA_DUNECASTER, '{1}{W}, {T}: Tap target creature without flying.');

export const DROMOKA_DUNECASTER_SCRIPT: CardScript = {
  oracleId: DROMOKA_DUNECASTER.oracleId,
  name: DROMOKA_DUNECASTER.name,
  activated: [
    {
      ref: `${DROMOKA_DUNECASTER.oracleId}#a0`,
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
