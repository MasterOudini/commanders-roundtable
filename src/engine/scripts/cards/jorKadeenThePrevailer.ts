// `Jor Kadeen, the Prevailer` - a conditional static (as long as you control three or more artifacts) anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JOR_KADEEN_THE_PREVAILER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JOR_KADEEN_THE_PREVAILER, "First strike\nMetalcraft — Creatures you control get +3/+0 as long as you control three or more artifacts.");
const LINES = PRINTED.split('\n');

// "as long as you control three or more artifacts" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Artifact")) continue;
    n++;
  }
  return n >= 3;
}


export const JOR_KADEEN_THE_PREVAILER_SCRIPT: CardScript = {
  oracleId: JOR_KADEEN_THE_PREVAILER.oracleId,
  name: JOR_KADEEN_THE_PREVAILER.name,
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self) && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
