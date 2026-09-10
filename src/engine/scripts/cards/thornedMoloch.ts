// `Thorned Moloch` - a conditional static (as long as it's attacking) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THORNED_MOLOCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THORNED_MOLOCH, "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nThis creature has first strike as long as it's attacking.");
const LINES = PRINTED.split('\n');

// "as long as it's attacking" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.combat?.attackers ?? []).some((a) => a.card === self);
}


export const THORNED_MOLOCH_SCRIPT: CardScript = {
  oracleId: THORNED_MOLOCH.oracleId,
  name: THORNED_MOLOCH.name,
  statics: [
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("firstStrike");
      },
    },
  ],
};
