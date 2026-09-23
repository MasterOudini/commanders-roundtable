// `Mirror-Sigil Sergeant` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MIRROR_SIGIL_SERGEANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIRROR_SIGIL_SERGEANT, "Trample\nAt the beginning of your upkeep, if you control a blue permanent, you may create a token that's a copy of this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a token that's a copy of this creature.", MIRROR_SIGIL_SERGEANT.name);
const VOCAB_T_L1 = vocabularyTargets("Create a token that's a copy of this creature.");

// "as long as you control a blue permanent" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.colors.includes("U")) continue;
    n++;
  }
  return n >= 1;
}


export const MIRROR_SIGIL_SERGEANT_SCRIPT: CardScript = {
  oracleId: MIRROR_SIGIL_SERGEANT.oracleId,
  name: MIRROR_SIGIL_SERGEANT.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Mirror-Sigil Sergeant - Create a token that's a copy of this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
