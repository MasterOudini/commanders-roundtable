// `Grixis Grimblade` - a conditional static (as long as you control another multicolored permanent) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRIXIS_GRIMBLADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRIXIS_GRIMBLADE, "As long as you control another multicolored permanent, this creature gets +1/+1 and has deathtouch. (Any amount of damage it deals to a creature is enough to destroy that creature.)");

// "as long as you control another multicolored permanent" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    if (inst.id === self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (face.colors.length < 2) continue;
    n++;
  }
  return n >= 1;
}


export const GRIXIS_GRIMBLADE_SCRIPT: CardScript = {
  oracleId: GRIXIS_GRIMBLADE.oracleId,
  name: GRIXIS_GRIMBLADE.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("deathtouch");
      },
    },
  ],
};
