// `Binding Mummy` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BINDING_MUMMY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BINDING_MUMMY, "Whenever another Zombie you control enters, you may tap target artifact or creature.");

const VOCAB_L0 = vocabularyEffects("Tap target artifact or creature.", BINDING_MUMMY.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target artifact or creature.");

export const BINDING_MUMMY_SCRIPT: CardScript = {
  oracleId: BINDING_MUMMY.oracleId,
  name: BINDING_MUMMY.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Zombie'),
        ),
      label: () => "Binding Mummy - Tap target artifact or creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
