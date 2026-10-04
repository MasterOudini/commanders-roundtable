// `Emeritus of Woe // Demonic Tutor` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMERITUS_OF_WOE_DEMONIC_TUTOR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(EMERITUS_OF_WOE_DEMONIC_TUTOR, "This creature enters prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)\nAt the beginning of your end step, if two or more creatures died this turn, this creature becomes prepared.\nSearch your library for a card, put that card into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ becomes prepared.", EMERITUS_OF_WOE_DEMONIC_TUTOR.name);
const VOCAB_T_L1 = vocabularyTargets("~ becomes prepared.");

// "as long as two or more creatures died this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const d of ctx.state.turn.memory.died) {
    const inst = ctx.state.cards[d.card];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && face.typeLine.types.includes('Creature')) n++;
  }
  return n >= 2;
}


export const EMERITUS_OF_WOE_DEMONIC_TUTOR_SCRIPT: CardScript = {
  oracleId: EMERITUS_OF_WOE_DEMONIC_TUTOR.oracleId,
  name: EMERITUS_OF_WOE_DEMONIC_TUTOR.name,
  triggers: [
    {
      abilityId: 'endStep-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Emeritus of Woe // Demonic Tutor - ~ becomes prepared.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
