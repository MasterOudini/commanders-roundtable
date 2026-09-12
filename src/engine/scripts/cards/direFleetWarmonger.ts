// `Dire Fleet Warmonger` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIRE_FLEET_WARMONGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIRE_FLEET_WARMONGER, "At the beginning of combat on your turn, you may sacrifice another creature. If you do, this creature gets +2/+2 and gains trample until end of turn. (It can deal excess combat damage to the player or planeswalker it's attacking.)");

const VOCAB_L0 = vocabularyEffects("You may sacrifice another creature. If you do, this creature gets +2/+2 and gains trample until end of turn.", DIRE_FLEET_WARMONGER.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice another creature. If you do, this creature gets +2/+2 and gains trample until end of turn.");

export const DIRE_FLEET_WARMONGER_SCRIPT: CardScript = {
  oracleId: DIRE_FLEET_WARMONGER.oracleId,
  name: DIRE_FLEET_WARMONGER.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Dire Fleet Warmonger - You may sacrifice another creature. If you do, this creature gets +2/+2 and gains trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
