// `Cutthroat il-Dal` - a conditional static (as long as you have no cards in hand) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CUTTHROAT_IL_DAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CUTTHROAT_IL_DAL, "Hellbent — This creature has shadow as long as you have no cards in hand. (It can block or be blocked by only creatures with shadow.)");

// "as long as you have no cards in hand" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.zones.hand[me] ?? []).length <= 0;
}


export const CUTTHROAT_IL_DAL_SCRIPT: CardScript = {
  oracleId: CUTTHROAT_IL_DAL.oracleId,
  name: CUTTHROAT_IL_DAL.name,
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("shadow");
      },
    },
  ],
};
