// `Ash, Party Crasher` - a attacks trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ASH_PARTY_CRASHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ASH_PARTY_CRASHER, "Haste\nCelebration — Whenever Ash attacks, if two or more nonland permanents entered the battlefield under your control this turn, put a +1/+1 counter on Ash.");
const LINES = PRINTED.split('\n');

// "as long as two or more nonland permanents entered the battlefield under your control this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const id of ctx.state.turn.memory.entered[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (!face.typeLine.types.includes('Land'))) n++;
  }
  return n >= 2;
}


export const ASH_PARTY_CRASHER_SCRIPT: CardScript = {
  oracleId: ASH_PARTY_CRASHER.oracleId,
  name: ASH_PARTY_CRASHER.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self)),
      label: () => "Ash, Party Crasher - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
