// `Moorland Drifter` - a conditional static (as long as there are four or more card types among cards in your graveyard) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOORLAND_DRIFTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOORLAND_DRIFTER, "Delirium — This creature has flying as long as there are four or more card types among cards in your graveyard.");

// "as long as there are four or more card types among cards in your graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
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


export const MOORLAND_DRIFTER_SCRIPT: CardScript = {
  oracleId: MOORLAND_DRIFTER.oracleId,
  name: MOORLAND_DRIFTER.name,
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
};
