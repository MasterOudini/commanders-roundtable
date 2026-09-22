// `Gonti's Machinations` - a youLoseLife trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GONTI_S_MACHINATIONS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GONTI_S_MACHINATIONS, "Whenever you lose life for the first time each turn, you get {E}. (You get an energy counter. Damage causes loss of life.)\nPay {E}{E}, Sacrifice this enchantment: Each opponent loses 3 life. You gain life equal to the life lost this way.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}.", GONTI_S_MACHINATIONS.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}.");
const VOCAB_A0 = vocabularyEffects("Each opponent loses 3 life. You gain life equal to the life lost this way.", GONTI_S_MACHINATIONS.name);
const VOCAB_T_A0 = vocabularyTargets("Each opponent loses 3 life. You gain life equal to the life lost this way.");

export const GONTIS_MACHINATIONS_SCRIPT: CardScript = {
  oracleId: GONTI_S_MACHINATIONS.oracleId,
  name: GONTI_S_MACHINATIONS.name,
  activated: [
    {
      ref: `${GONTI_S_MACHINATIONS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'youLoseLife-0',
      text: LINES[0] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      looksBack: true,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta < 0 && ev.player === ctx.query.controllerOf(self) && ctx.state.turn.memory.lostLife[ev.player] !== true,
      label: () => "Gonti's Machinations - You get {E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
