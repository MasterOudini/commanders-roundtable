// `Chaos Imps` - a conditional static (as long as it has a +1/+1 counter on it) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHAOS_IMPS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHAOS_IMPS, "Flying\nUnleash (You may have this creature enter with a +1/+1 counter on it. It can't block as long as it has a +1/+1 counter on it.)\nThis creature has trample as long as it has a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

// "as long as it has a +1/+1 counter on it" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ((ctx.state.cards[self]?.counters["+1/+1"] ?? 0) > 0) === true;
}


export const CHAOS_IMPS_SCRIPT: CardScript = {
  oracleId: CHAOS_IMPS.oracleId,
  name: CHAOS_IMPS.name,
  statics: [
    {
      abilityId: 'threshold-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond2Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
