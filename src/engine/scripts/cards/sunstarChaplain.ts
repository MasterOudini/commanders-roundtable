// `Sunstar Chaplain` - a endStep trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNSTAR_CHAPLAIN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(SUNSTAR_CHAPLAIN, "At the beginning of your end step, if you control two or more tapped creatures, put a +1/+1 counter on target creature you control.\n{2}, Remove a +1/+1 counter from a creature you control: Tap target artifact or creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target creature you control.", SUNSTAR_CHAPLAIN.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target creature you control.");
const VOCAB_A0 = vocabularyEffects("Tap target artifact or creature.", SUNSTAR_CHAPLAIN.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target artifact or creature.");

// "as long as you control two or more tapped creatures" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    if (!inst.tapped) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Creature")) continue;
    n++;
  }
  return n >= 2;
}


export const SUNSTAR_CHAPLAIN_SCRIPT: CardScript = {
  oracleId: SUNSTAR_CHAPLAIN.oracleId,
  name: SUNSTAR_CHAPLAIN.name,
  activated: [
    {
      ref: `${SUNSTAR_CHAPLAIN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'endStep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Sunstar Chaplain - Put a +1/+1 counter on target creature you control.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
