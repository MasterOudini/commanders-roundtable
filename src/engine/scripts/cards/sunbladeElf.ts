// `Sunblade Elf` - a conditional static (as long as you control a Plains) threshold, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNBLADE_ELF } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
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

const PRINTED = printed(SUNBLADE_ELF, "This creature gets +1/+1 as long as you control a Plains.\n{4}{W}: Creatures you control get +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

// "as long as you control a Plains" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes("Plains")) continue;
    n++;
  }
  return n >= 1;
}


export const SUNBLADE_ELF_SCRIPT: CardScript = {
  oracleId: SUNBLADE_ELF.oracleId,
  name: SUNBLADE_ELF.name,
  activated: [
    {
      ref: `${SUNBLADE_ELF.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1 });
        }
        return out;
      },
    },
  ],
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
