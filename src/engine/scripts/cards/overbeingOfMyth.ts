// `Overbeing of Myth` - a static cdaCount, a yourDrawStep trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OVERBEING_OF_MYTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OVERBEING_OF_MYTH, "Overbeing of Myth's power and toughness are each equal to the number of cards in your hand.\nAt the beginning of your draw step, draw an additional card.");
const LINES = PRINTED.split('\n');

// "cards in your hand", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  return (ctx.state.zones.hand[me.controller] ?? []).length;
}


export const OVERBEING_OF_MYTH_SCRIPT: CardScript = {
  oracleId: OVERBEING_OF_MYTH.oracleId,
  name: OVERBEING_OF_MYTH.name,
  triggers: [
    {
      abilityId: 'yourDrawStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'draw' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Overbeing of Myth - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'cda-0',
      text: LINES[0] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_0(ctx, self);
        chars.power = n;
        chars.toughness = n;
      },
    },
  ],
};
