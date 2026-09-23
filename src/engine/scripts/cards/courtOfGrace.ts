// `Court of Grace` - a etb trigger monarch, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COURT_OF_GRACE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { n, narrated, vb, who } from '../../narrate';

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

const PRINTED = printed(COURT_OF_GRACE, "When this enchantment enters, you become the monarch.\nAt the beginning of your upkeep, create a 1/1 white Spirit creature token with flying. If you're the monarch, create a 4/4 white Angel creature token with flying instead.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a 1/1 white Spirit creature token with flying. If you're the monarch, create a 4/4 white Angel creature token with flying instead.", COURT_OF_GRACE.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 1/1 white Spirit creature token with flying. If you're the monarch, create a 4/4 white Angel creature token with flying instead.");

export const COURT_OF_GRACE_SCRIPT: CardScript = {
  oracleId: COURT_OF_GRACE.oracleId,
  name: COURT_OF_GRACE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Court of Grace - monarch",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [{ t: 'MonarchChanged', player: obj.controller }, narrated(n`${who(ctx.state, obj.controller)} ${vb(obj.controller, 'becomes', 'become')} the monarch.`, obj.controller)];
      },
    },
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Court of Grace - Create a 1/1 white Spirit creature token with flying. If you're the monarch, create a 4/4 white Angel creature token with flying instead.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
