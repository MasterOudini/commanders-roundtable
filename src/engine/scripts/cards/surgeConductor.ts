// `Surge Conductor` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SURGE_CONDUCTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SURGE_CONDUCTOR, "Whenever another nontoken artifact you control enters, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");

const VOCAB_L0 = vocabularyEffects("Proliferate.", SURGE_CONDUCTOR.name);
const VOCAB_T_L0 = vocabularyTargets("Proliferate.");

export const SURGE_CONDUCTOR_SCRIPT: CardScript = {
  oracleId: SURGE_CONDUCTOR.oracleId,
  name: SURGE_CONDUCTOR.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Surge Conductor - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
