// `Vashta Nerada` - a eachEndStep trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VASHTA_NERADA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VASHTA_NERADA, "Indestructible\nShadow (This creature can block or be blocked by only creatures with shadow.)\nMorbid — At the beginning of each end step, if a creature died this turn, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

// "as long as a creature died this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.memory.died.some((d) => { const inst = ctx.state.cards[d.card]; const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined; return !!face && face.typeLine.types.includes('Creature'); });
}


export const VASHTA_NERADA_SCRIPT: CardScript = {
  oracleId: VASHTA_NERADA.oracleId,
  name: VASHTA_NERADA.name,
  triggers: [
    {
      abilityId: 'eachEndStep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end'),
      label: () => "Vashta Nerada - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
