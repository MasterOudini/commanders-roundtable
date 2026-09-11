// `Brightspear Zealot` - a conditional static (as long as you've cast two or more spells this turn) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRIGHTSPEAR_ZEALOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRIGHTSPEAR_ZEALOT, "Vigilance\nThis creature gets +2/+0 as long as you've cast two or more spells this turn.");
const LINES = PRINTED.split('\n');

// "as long as you've cast two or more spells this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.memory.cast[me] ?? []).length >= 2;
}


export const BRIGHTSPEAR_ZEALOT_SCRIPT: CardScript = {
  oracleId: BRIGHTSPEAR_ZEALOT.oracleId,
  name: BRIGHTSPEAR_ZEALOT.name,
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
