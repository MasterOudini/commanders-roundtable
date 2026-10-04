// `Burnout Bashtronaut` - an activation pumping itself, a conditional static (as long as you have max speed) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BURNOUT_BASHTRONAUT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
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

const PRINTED = printed(BURNOUT_BASHTRONAUT, "Menace\nStart your engines! (If you have no speed, it starts at 1. It increases once on each of your turns when an opponent loses life. Max speed is 4.)\n{2}: This creature gets +1/+0 until end of turn.\nMax speed — This creature has double strike.");
const LINES = PRINTED.split('\n');

// "as long as you have max speed" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond3Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.speed ?? 0) >= 4;
}


export const BURNOUT_BASHTRONAUT_SCRIPT: CardScript = {
  oracleId: BURNOUT_BASHTRONAUT.oracleId,
  name: BURNOUT_BASHTRONAUT.name,
  activated: [
    {
      ref: `${BURNOUT_BASHTRONAUT.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'threshold-grant-3',
      text: LINES[3] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond3Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("doubleStrike");
      },
    },
  ],
};
