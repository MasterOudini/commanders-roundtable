// `Sylvan Yeti` - a static cdaPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SYLVAN_YETI } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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

const PRINTED = printed(SYLVAN_YETI, "Sylvan Yeti's power is equal to the number of cards in your hand.");

// "cards in your hand", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  return (ctx.state.zones.hand[me.controller] ?? []).length;
}


export const SYLVAN_YETI_SCRIPT: CardScript = {
  oracleId: SYLVAN_YETI.oracleId,
  name: SYLVAN_YETI.name,
  statics: [
    {
      abilityId: 'cda-0',
      text: PRINTED,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_0(ctx, self);
        chars.power = n;
      },
    },
  ],
};
