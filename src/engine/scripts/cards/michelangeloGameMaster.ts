// `Michelangelo, Game Master` - a endStep trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MICHELANGELO_GAME_MASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MICHELANGELO_GAME_MASTER, "Disappear — At the beginning of your end step, if a permanent left the battlefield under your control this turn, put a +1/+1 counter on Michelangelo.");

// "as long as a permanent left the battlefield under your control this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const e of ctx.state.turn.memory.left) {
    if (e.controller !== me) continue;
    return true;
  }
  return false;
}


export const MICHELANGELO_GAME_MASTER_SCRIPT: CardScript = {
  oracleId: MICHELANGELO_GAME_MASTER.oracleId,
  name: MICHELANGELO_GAME_MASTER.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Michelangelo, Game Master - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
