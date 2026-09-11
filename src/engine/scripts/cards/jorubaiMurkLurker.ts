// `Jorubai Murk Lurker` - a conditional static (as long as you control a Swamp) threshold, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JORUBAI_MURK_LURKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JORUBAI_MURK_LURKER, "This creature gets +1/+1 as long as you control a Swamp.\n{1}{B}: Target creature gains lifelink until end of turn. (Damage dealt by the creature also causes its controller to gain that much life.)");
const LINES = PRINTED.split('\n');

// "as long as you control a Swamp" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes("Swamp")) continue;
    n++;
  }
  return n >= 1;
}


export const JORUBAI_MURK_LURKER_SCRIPT: CardScript = {
  oracleId: JORUBAI_MURK_LURKER.oracleId,
  name: JORUBAI_MURK_LURKER.name,
  activated: [
    {
      ref: `${JORUBAI_MURK_LURKER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["lifelink"] }];
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
