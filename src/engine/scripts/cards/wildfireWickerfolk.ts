// `Wildfire Wickerfolk` - a conditional static (as long as there are four or more card types among cards in your graveyard) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WILDFIRE_WICKERFOLK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WILDFIRE_WICKERFOLK, "Haste\nDelirium — This creature gets +1/+1 and has trample as long as there are four or more card types among cards in your graveyard.");
const LINES = PRINTED.split('\n');

// "as long as there are four or more card types among cards in your graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  const types = new Set<string>();
  for (const id of ctx.state.zones.graveyard[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (!face) continue;
    for (const ty of face.typeLine.types) types.add(ty);
  }
  return types.size >= 4;
}


export const WILDFIRE_WICKERFOLK_SCRIPT: CardScript = {
  oracleId: WILDFIRE_WICKERFOLK.oracleId,
  name: WILDFIRE_WICKERFOLK.name,
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
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
