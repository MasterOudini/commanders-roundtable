// `Chocobo Racetrack` - a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHOCOBO_RACETRACK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHOCOBO_RACETRACK, "Landfall — Whenever a land you control enters, create a 2/2 green Bird creature token with \"Whenever a land you control enters, this token gets +1/+0 until end of turn.\"");

const VOCAB_L0 = vocabularyEffects("Create a 2/2 green Bird creature token with \"Whenever a land you control enters, this token gets +1/+0 until end of turn.\"", CHOCOBO_RACETRACK.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 2/2 green Bird creature token with \"Whenever a land you control enters, this token gets +1/+0 until end of turn.\"");

export const CHOCOBO_RACETRACK_SCRIPT: CardScript = {
  oracleId: CHOCOBO_RACETRACK.oracleId,
  name: CHOCOBO_RACETRACK.name,
  triggers: [
    {
      abilityId: 'landfall-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Chocobo Racetrack - Create a 2/2 green Bird creature token with \"Whenever a land you control enters, this token gets +1/+0 until end of turn.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
