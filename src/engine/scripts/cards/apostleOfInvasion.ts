// `Apostle of Invasion` - a conditional static (as long as an opponent has three or more poison counters) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APOSTLE_OF_INVASION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APOSTLE_OF_INVASION, "Flying\nCorrupted — As long as an opponent has three or more poison counters, this creature has double strike.");
const LINES = PRINTED.split('\n');

// "as long as an opponent has three or more poison counters" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.seating.filter((p) => p !== me).some((p) => (ctx.state.players[p]?.poison ?? 0) >= 3);
}


export const APOSTLE_OF_INVASION_SCRIPT: CardScript = {
  oracleId: APOSTLE_OF_INVASION.oracleId,
  name: APOSTLE_OF_INVASION.name,
  statics: [
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("doubleStrike");
      },
    },
  ],
};
