// `Angelic Overseer` - a conditional static (as long as you control a Human) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANGELIC_OVERSEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANGELIC_OVERSEER, "Flying\nAs long as you control a Human, this creature has hexproof and indestructible.");
const LINES = PRINTED.split('\n');

// "as long as you control a Human" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes("Human")) continue;
    n++;
  }
  return n >= 1;
}


export const ANGELIC_OVERSEER_SCRIPT: CardScript = {
  oracleId: ANGELIC_OVERSEER.oracleId,
  name: ANGELIC_OVERSEER.name,
  statics: [
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("hexproof");
        chars.keywords.add("indestructible");
      },
    },
  ],
};
