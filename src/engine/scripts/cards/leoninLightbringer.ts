// `Leonin Lightbringer` - a conditional static (as long as this creature is equipped) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEONIN_LIGHTBRINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LEONIN_LIGHTBRINGER, "Ward {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\nAs long as this creature is equipped, it gets +1/+1.");
const LINES = PRINTED.split('\n');

// "as long as this creature is equipped" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.attachedTo !== self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (face && face.typeLine.subtypes.includes("Equipment")) return true;
  }
  return false;
}


export const LEONIN_LIGHTBRINGER_SCRIPT: CardScript = {
  oracleId: LEONIN_LIGHTBRINGER.oracleId,
  name: LEONIN_LIGHTBRINGER.name,
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
