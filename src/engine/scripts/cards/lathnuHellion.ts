// `Lathnu Hellion` - a etb trigger vocab, a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LATHNU_HELLION } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(LATHNU_HELLION, "Haste\nWhen this creature enters, you get {E}{E} (two energy counters).\nAt the beginning of your end step, sacrifice this creature unless you pay {E}{E}.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You get {E}{E}.", LATHNU_HELLION.name);
const VOCAB_T_L1 = vocabularyTargets("You get {E}{E}.");
const VOCAB_L2 = vocabularyEffects("Sacrifice this creature unless you pay {E}{E}.", LATHNU_HELLION.name);
const VOCAB_T_L2 = vocabularyTargets("Sacrifice this creature unless you pay {E}{E}.");

export const LATHNU_HELLION_SCRIPT: CardScript = {
  oracleId: LATHNU_HELLION.oracleId,
  name: LATHNU_HELLION.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Lathnu Hellion - You get {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'endStep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Lathnu Hellion - Sacrifice this creature unless you pay {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
