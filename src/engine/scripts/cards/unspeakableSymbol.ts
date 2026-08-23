// `Unspeakable Symbol` — the fixed-life activation cost (D165's Book of Rass)
// with NO mana at all: three life buys a counter, and it can be paid as often
// as the life lasts. D264.

import { UNSPEAKABLE_SYMBOL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(UNSPEAKABLE_SYMBOL, 'Pay 3 life: Put a +1/+1 counter on target creature.');

export const UNSPEAKABLE_SYMBOL_SCRIPT: CardScript = {
  oracleId: UNSPEAKABLE_SYMBOL.oracleId,
  name: UNSPEAKABLE_SYMBOL.name,
  activated: [
    {
      ref: `${UNSPEAKABLE_SYMBOL.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }];
      },
    },
  ],
};
