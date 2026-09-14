// `Ascendant Dustspeaker` - a etb trigger vocab, a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ASCENDANT_DUSTSPEAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ASCENDANT_DUSTSPEAKER, "Flying\nWhen this creature enters, put a +1/+1 counter on another target creature you control.\nAt the beginning of combat on your turn, exile up to one target card from a graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on another target creature you control.", ASCENDANT_DUSTSPEAKER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on another target creature you control.");
const VOCAB_L2 = vocabularyEffects("Exile up to one target card from a graveyard.", ASCENDANT_DUSTSPEAKER.name);
const VOCAB_T_L2 = vocabularyTargets("Exile up to one target card from a graveyard.");

export const ASCENDANT_DUSTSPEAKER_SCRIPT: CardScript = {
  oracleId: ASCENDANT_DUSTSPEAKER.oracleId,
  name: ASCENDANT_DUSTSPEAKER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ascendant Dustspeaker - Put a +1/+1 counter on another target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'combatOnYourTurn-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Ascendant Dustspeaker - Exile up to one target card from a graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
