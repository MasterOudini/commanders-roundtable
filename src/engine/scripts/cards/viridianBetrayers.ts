// `Viridian Betrayers` - a conditional static (as long as an opponent is poisoned) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIRIDIAN_BETRAYERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIRIDIAN_BETRAYERS, "This creature has infect as long as an opponent is poisoned. (It deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)");

// "as long as an opponent is poisoned" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.seating.filter((p) => p !== me).some((p) => (ctx.state.players[p]?.poison ?? 0) >= 1);
}


export const VIRIDIAN_BETRAYERS_SCRIPT: CardScript = {
  oracleId: VIRIDIAN_BETRAYERS.oracleId,
  name: VIRIDIAN_BETRAYERS.name,
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("infect");
      },
    },
  ],
};
