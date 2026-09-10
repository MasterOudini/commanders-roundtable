// `Radiant Essence` - a conditional static (as long as an opponent controls a black permanent) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RADIANT_ESSENCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RADIANT_ESSENCE, "This creature gets +1/+2 as long as an opponent controls a black permanent.");

// "as long as an opponent controls a black permanent" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller === me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.colors.includes("B")) continue;
    n++;
  }
  return n >= 1;
}


export const RADIANT_ESSENCE_SCRIPT: CardScript = {
  oracleId: RADIANT_ESSENCE.oracleId,
  name: RADIANT_ESSENCE.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
