// `Woolly Mammoths` - a conditional static (as long as you control a snow land) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WOOLLY_MAMMOTHS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WOOLLY_MAMMOTHS, "This creature has trample as long as you control a snow land.");

// "as long as you control a snow land" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Land")) continue;
    if (!face.typeLine.supertypes.includes("Snow")) continue;
    n++;
  }
  return n >= 1;
}


export const WOOLLY_MAMMOTHS_SCRIPT: CardScript = {
  oracleId: WOOLLY_MAMMOTHS.oracleId,
  name: WOOLLY_MAMMOTHS.name,
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
