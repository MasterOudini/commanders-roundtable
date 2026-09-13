// `Osai Vultures` - a eachEndStep trigger selfCounter, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OSAI_VULTURES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OSAI_VULTURES, "Flying\nAt the beginning of each end step, if a creature died this turn, put a carrion counter on this creature.\nRemove two carrion counters from this creature: This creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

// "as long as a creature died this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.memory.died.some((d) => { const inst = ctx.state.cards[d.card]; const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined; return !!face && face.typeLine.types.includes('Creature'); });
}


export const OSAI_VULTURES_SCRIPT: CardScript = {
  oracleId: OSAI_VULTURES.oracleId,
  name: OSAI_VULTURES.name,
  activated: [
    {
      ref: `${OSAI_VULTURES.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'eachEndStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end'),
      label: () => "Osai Vultures - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "carrion", delta: 1 }] }];
      },
    },
  ],
};
