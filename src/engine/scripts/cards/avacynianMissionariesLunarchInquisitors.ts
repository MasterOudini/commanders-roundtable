// `Avacynian Missionaries // Lunarch Inquisitors` - a endStep trigger vocab, a transformsInto trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVACYNIAN_MISSIONARIES_LUNARCH_INQUISITORS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(AVACYNIAN_MISSIONARIES_LUNARCH_INQUISITORS, "At the beginning of your end step, if this creature is equipped, transform it.\nWhen this creature transforms into Lunarch Inquisitors, you may exile another target creature until this creature leaves the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = transformFrom(vocabularyEffects("Transform it.", AVACYNIAN_MISSIONARIES_LUNARCH_INQUISITORS.name), 0);
const VOCAB_T_L0 = vocabularyTargets("Transform it.");
const VOCAB_L1 = vocabularyEffects("Exile another target creature until this creature leaves the battlefield.", AVACYNIAN_MISSIONARIES_LUNARCH_INQUISITORS.name);
const VOCAB_T_L1 = vocabularyTargets("Exile another target creature until this creature leaves the battlefield.");

// "as long as this creature is equipped" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.phasedOut || inst.attachedTo !== self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (face && face.typeLine.subtypes.includes("Equipment")) return true;
  }
  return false;
}


export const AVACYNIAN_MISSIONARIES_LUNARCH_INQUISITORS_SCRIPT: CardScript = {
  oracleId: AVACYNIAN_MISSIONARIES_LUNARCH_INQUISITORS.oracleId,
  name: AVACYNIAN_MISSIONARIES_LUNARCH_INQUISITORS.name,
  triggers: [
    {
      abilityId: 'endStep-0', face: 0,
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Avacynian Missionaries // Lunarch Inquisitors - Transform it.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'transformsInto-1', face: 1,
      text: LINES[1] as string,
      event: 'FaceIndexSet',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'FaceIndexSet' && ev.card === self,
      label: () => "Avacynian Missionaries // Lunarch Inquisitors - Exile another target creature until this creature leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
