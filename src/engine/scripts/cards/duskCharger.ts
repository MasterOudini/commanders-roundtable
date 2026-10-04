// `Dusk Charger` - a conditional static (as long as you have the city's blessing) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUSK_CHARGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUSK_CHARGER, "Ascend (If you control ten or more permanents, you get the city's blessing for the rest of the game.)\nThis creature gets +2/+2 as long as you have the city's blessing.");
const LINES = PRINTED.split('\n');

// "as long as you have the city's blessing" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.players[me]?.citysBlessing === true;
}


export const DUSK_CHARGER_SCRIPT: CardScript = {
  oracleId: DUSK_CHARGER.oracleId,
  name: DUSK_CHARGER.name,
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
