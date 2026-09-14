// `Sima Yi, Wei Field Marshal` - a static cdaPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIMA_YI_WEI_FIELD_MARSHAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIMA_YI_WEI_FIELD_MARSHAL, "Sima Yi's power is equal to the number of Swamps you control.");

// "Swamps you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes('Swamp')) continue;
    n++;
  }
  return n;
}


export const SIMA_YI_WEI_FIELD_MARSHAL_SCRIPT: CardScript = {
  oracleId: SIMA_YI_WEI_FIELD_MARSHAL.oracleId,
  name: SIMA_YI_WEI_FIELD_MARSHAL.name,
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
