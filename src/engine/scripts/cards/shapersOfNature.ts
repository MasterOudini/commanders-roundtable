// `Shapers of Nature` - an activation counterOnTarget, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHAPERS_OF_NATURE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SHAPERS_OF_NATURE, "{3}{G}: Put a +1/+1 counter on target creature.\n{2}{U}, Remove a +1/+1 counter from a creature you control: Draw a card.");
const LINES = PRINTED.split('\n');

export const SHAPERS_OF_NATURE_SCRIPT: CardScript = {
  oracleId: SHAPERS_OF_NATURE.oracleId,
  name: SHAPERS_OF_NATURE.name,
  activated: [
    {
      ref: `${SHAPERS_OF_NATURE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 1 }] }];
      },
    },
    {
      ref: `${SHAPERS_OF_NATURE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
