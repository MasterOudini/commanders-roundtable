// `Ruthless Cullblade` - a conditional static (as long as an opponent has 10 or less life) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUTHLESS_CULLBLADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUTHLESS_CULLBLADE, "This creature gets +2/+1 as long as an opponent has 10 or less life.");

// "as long as an opponent has 10 or less life" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.seating.filter((p) => p !== me).some((p) => (ctx.state.players[p]?.life ?? 0) <= 10);
}


export const RUTHLESS_CULLBLADE_SCRIPT: CardScript = {
  oracleId: RUTHLESS_CULLBLADE.oracleId,
  name: RUTHLESS_CULLBLADE.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
