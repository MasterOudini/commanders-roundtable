// `Chaos Terminator Lord` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHAOS_TERMINATOR_LORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHAOS_TERMINATOR_LORD, "Lord of Chaos — At the beginning of combat on your turn, another target creature you control gains double strike until end of turn.");

const VOCAB_L0 = vocabularyEffects("Another target creature you control gains double strike until end of turn.", CHAOS_TERMINATOR_LORD.name);
const VOCAB_T_L0 = vocabularyTargets("Another target creature you control gains double strike until end of turn.");

export const CHAOS_TERMINATOR_LORD_SCRIPT: CardScript = {
  oracleId: CHAOS_TERMINATOR_LORD.oracleId,
  name: CHAOS_TERMINATOR_LORD.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Chaos Terminator Lord - Another target creature you control gains double strike until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
