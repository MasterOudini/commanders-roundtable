// `Drumhunter` - a endStep trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRUMHUNTER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(DRUMHUNTER, "At the beginning of your end step, if you control a creature with power 5 or greater, you may draw a card.\n{T}: Add {C}.");
const LINES = PRINTED.split('\n');

// "as long as you control a creature with power 5 or greater" - read off the DERIVED power of the controller's creatures (D621 - an intervening if and an activation only, never a static).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.zones.battlefield.some((id) => ctx.state.cards[id]?.controller === me && ctx.derive(id).isCreature && (ctx.derive(id).power ?? -1) >= 5);
}


export const DRUMHUNTER_SCRIPT: CardScript = {
  oracleId: DRUMHUNTER.oracleId,
  name: DRUMHUNTER.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Drumhunter - draw",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
