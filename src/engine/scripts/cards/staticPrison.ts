// `Static Prison` - a etb trigger vocab, a firstMainPhase trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STATIC_PRISON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STATIC_PRISON, "When this enchantment enters, exile target nonland permanent an opponent controls until this enchantment leaves the battlefield. You get {E}{E} (two energy counters).\nAt the beginning of your first main phase, sacrifice this enchantment unless you pay {E}.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile target nonland permanent an opponent controls until this enchantment leaves the battlefield. You get {E}{E}.", STATIC_PRISON.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target nonland permanent an opponent controls until this enchantment leaves the battlefield. You get {E}{E}.");
const VOCAB_L1 = vocabularyEffects("Sacrifice this enchantment unless you pay {E}.", STATIC_PRISON.name);
const VOCAB_T_L1 = vocabularyTargets("Sacrifice this enchantment unless you pay {E}.");

export const STATIC_PRISON_SCRIPT: CardScript = {
  oracleId: STATIC_PRISON.oracleId,
  name: STATIC_PRISON.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Static Prison - Exile target nonland permanent an opponent controls until this enchantment leaves the battlefield. You get {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'firstMainPhase-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'precombatMain' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Static Prison - Sacrifice this enchantment unless you pay {E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
