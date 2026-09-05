// `Slag Fiend` - a static cdaCount
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLAG_FIEND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLAG_FIEND, "Slag Fiend's power and toughness are each equal to the number of artifact cards in all graveyards.");

// "artifact cards in all graveyards", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  const cards = Object.values(ctx.state.zones.graveyard).flat();
  let n = 0;
  for (const id of cards) {
    const inst = ctx.state.cards[id];
    if (!inst) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Artifact')) continue;
    n++;
  }
  return n;
}


export const SLAG_FIEND_SCRIPT: CardScript = {
  oracleId: SLAG_FIEND.oracleId,
  name: SLAG_FIEND.name,
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
        chars.toughness = n;
      },
    },
  ],
};
