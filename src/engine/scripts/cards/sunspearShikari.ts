// `Sunspear Shikari` - a conditional static (as long as this creature is equipped) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNSPEAR_SHIKARI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNSPEAR_SHIKARI, "As long as this creature is equipped, it has first strike and lifelink. (It deals combat damage before creatures without first strike. Damage dealt by it also causes you to gain that much life.)");

// "as long as this creature is equipped" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.attachedTo !== self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (face && face.typeLine.subtypes.includes("Equipment")) return true;
  }
  return false;
}


export const SUNSPEAR_SHIKARI_SCRIPT: CardScript = {
  oracleId: SUNSPEAR_SHIKARI.oracleId,
  name: SUNSPEAR_SHIKARI.name,
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("firstStrike");
        chars.keywords.add("lifelink");
      },
    },
  ],
};
