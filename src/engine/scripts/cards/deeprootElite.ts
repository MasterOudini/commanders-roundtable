// `Deeproot Elite` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEEPROOT_ELITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEEPROOT_ELITE, "Whenever another Merfolk you control enters, put a +1/+1 counter on target Merfolk you control.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target Merfolk you control.", DEEPROOT_ELITE.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target Merfolk you control.");

export const DEEPROOT_ELITE_SCRIPT: CardScript = {
  oracleId: DEEPROOT_ELITE.oracleId,
  name: DEEPROOT_ELITE.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Merfolk'),
        ),
      label: () => "Deeproot Elite - Put a +1/+1 counter on target Merfolk you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
