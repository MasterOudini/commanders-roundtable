// `Sunseed Nurturer` - a endStep trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNSEED_NURTURER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNSEED_NURTURER, "At the beginning of your end step, if you control a creature with power 5 or greater, you may gain 2 life.\n{T}: Add {C}.");
const LINES = PRINTED.split('\n');

// "as long as you control a creature with power 5 or greater" - read off the DERIVED power of the controller's creatures (D621 - an intervening if and an activation only, never a static).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.zones.battlefield.some((id) => ctx.state.cards[id]?.controller === me && ctx.derive(id).isCreature && (ctx.derive(id).power ?? -1) >= 5);
}


export const SUNSEED_NURTURER_SCRIPT: CardScript = {
  oracleId: SUNSEED_NURTURER.oracleId,
  name: SUNSEED_NURTURER.name,
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
      label: () => "Sunseed Nurturer - gain life",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
