// `Crimson Muckwader` - a conditional static (as long as you control a Swamp) threshold, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRIMSON_MUCKWADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRIMSON_MUCKWADER, "This creature gets +1/+1 as long as you control a Swamp.\n{2}{B}: Regenerate this creature. (The next time this creature would be destroyed this turn, instead tap it, remove it from combat, and heal all damage on it.)");
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


export const CRIMSON_MUCKWADER_SCRIPT: CardScript = {
  oracleId: CRIMSON_MUCKWADER.oracleId,
  name: CRIMSON_MUCKWADER.name,
  activated: [
    {
      ref: `${CRIMSON_MUCKWADER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
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
