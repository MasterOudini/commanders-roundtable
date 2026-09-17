// `Sheoldred, Whispering One` - a upkeep trigger vocab, a eachOpponentUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHEOLDRED_WHISPERING_ONE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHEOLDRED_WHISPERING_ONE, "Swampwalk (This creature can't be blocked as long as defending player controls a Swamp.)\nAt the beginning of your upkeep, return target creature card from your graveyard to the battlefield.\nAt the beginning of each opponent's upkeep, that player sacrifices a creature of their choice.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target creature card from your graveyard to the battlefield.", SHEOLDRED_WHISPERING_ONE.name);
const VOCAB_T_L1 = vocabularyTargets("Return target creature card from your graveyard to the battlefield.");
const VOCAB_L2 = vocabularyEffects("Target player sacrifices a creature of target player's choice.", SHEOLDRED_WHISPERING_ONE.name);
const VOCAB_T_L2 = vocabularyTargets("Target player sacrifices a creature of target player's choice.");

export const SHEOLDRED_WHISPERING_ONE_SCRIPT: CardScript = {
  oracleId: SHEOLDRED_WHISPERING_ONE.oracleId,
  name: SHEOLDRED_WHISPERING_ONE.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Sheoldred, Whispering One - Return target creature card from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'eachOpponentUpkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer !== ctx.query.controllerOf(self),
      label: () => "Sheoldred, Whispering One - Target player sacrifices a creature of target player's choice.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L2.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
