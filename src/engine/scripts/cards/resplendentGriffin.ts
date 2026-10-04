// `Resplendent Griffin` - a attacks trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RESPLENDENT_GRIFFIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RESPLENDENT_GRIFFIN, "Flying\nAscend (If you control ten or more permanents, you get the city's blessing for the rest of the game.)\nWhenever this creature attacks, if you have the city's blessing, put a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

// "as long as you have the city's blessing" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.players[me]?.citysBlessing === true;
}


export const RESPLENDENT_GRIFFIN_SCRIPT: CardScript = {
  oracleId: RESPLENDENT_GRIFFIN.oracleId,
  name: RESPLENDENT_GRIFFIN.name,
  triggers: [
    {
      abilityId: 'attacks-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self)),
      label: () => "Resplendent Griffin - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
