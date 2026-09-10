// `Konda's Hatamoto` - a conditional static (as long as you control a legendary Samurai) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KONDA_S_HATAMOTO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KONDA_S_HATAMOTO, "Bushido 1 (Whenever this creature blocks or becomes blocked, it gets +1/+1 until end of turn.)\nAs long as you control a legendary Samurai, this creature gets +1/+2 and has vigilance. (Attacking doesn't cause this creature to tap.)");
const LINES = PRINTED.split('\n');

// "as long as you control a legendary Samurai" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes("Samurai")) continue;
    if (!face.typeLine.supertypes.includes("Legendary")) continue;
    n++;
  }
  return n >= 1;
}


export const KONDAS_HATAMOTO_SCRIPT: CardScript = {
  oracleId: KONDA_S_HATAMOTO.oracleId,
  name: KONDA_S_HATAMOTO.name,
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("vigilance");
      },
    },
  ],
};
