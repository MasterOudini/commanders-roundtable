// `Nimana Skitter-Sneak` - a conditional static (as long as an opponent has eight or more cards in their graveyard) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIMANA_SKITTER_SNEAK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIMANA_SKITTER_SNEAK, "As long as an opponent has eight or more cards in their graveyard, this creature gets +1/+0 and has menace. (It can't be blocked except by two or more creatures.)");

// "as long as an opponent has eight or more cards in their graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.seating.filter((p) => p !== me).some((p) => (ctx.state.zones.graveyard[p] ?? []).length >= 8);
}


export const NIMANA_SKITTER_SNEAK_SCRIPT: CardScript = {
  oracleId: NIMANA_SKITTER_SNEAK.oracleId,
  name: NIMANA_SKITTER_SNEAK.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("menace");
      },
    },
  ],
};
