// `Timely Hordemate` - a raidEtb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TIMELY_HORDEMATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TIMELY_HORDEMATE, "Raid — When this creature enters, if you attacked this turn, return target creature card with mana value 2 or less from your graveyard to the battlefield.");

const VOCAB_L0 = vocabularyEffects("Return target creature card with mana value 2 or less from your graveyard to the battlefield.", TIMELY_HORDEMATE.name);
const VOCAB_T_L0 = vocabularyTargets("Return target creature card with mana value 2 or less from your graveyard to the battlefield.");

export const TIMELY_HORDEMATE_SCRIPT: CardScript = {
  oracleId: TIMELY_HORDEMATE.oracleId,
  name: TIMELY_HORDEMATE.name,
  triggers: [
    {
      abilityId: 'raidEtb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ctx.state.turn.attacked && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Timely Hordemate - Return target creature card with mana value 2 or less from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
