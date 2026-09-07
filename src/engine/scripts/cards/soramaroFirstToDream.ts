// `Soramaro, First to Dream` - a static cdaCount, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SORAMARO_FIRST_TO_DREAM } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(SORAMARO_FIRST_TO_DREAM, "Flying\nSoramaro's power and toughness are each equal to the number of cards in your hand.\n{4}, Return a land you control to its owner's hand: Draw a card.");
const LINES = PRINTED.split('\n');

// "cards in your hand", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  return (ctx.state.zones.hand[me.controller] ?? []).length;
}


export const SORAMARO_FIRST_TO_DREAM_SCRIPT: CardScript = {
  oracleId: SORAMARO_FIRST_TO_DREAM.oracleId,
  name: SORAMARO_FIRST_TO_DREAM.name,
  activated: [
    {
      ref: `${SORAMARO_FIRST_TO_DREAM.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'cda-1',
      text: LINES[1] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_1(ctx, self);
        chars.power = n;
        chars.toughness = n;
      },
    },
  ],
};
