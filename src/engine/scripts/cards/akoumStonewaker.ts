// `Akoum Stonewaker` - a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AKOUM_STONEWAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AKOUM_STONEWAKER, "Landfall — Whenever a land you control enters, you may pay {2}{R}. If you do, create a 3/1 red Elemental creature token with trample and haste. Exile that token at the beginning of the next end step.");

const VOCAB_L0 = vocabularyEffects("You may pay {2}{R}. If you do, create a 3/1 red Elemental creature token with trample and haste. Exile that token at the beginning of the next end step.", AKOUM_STONEWAKER.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}{R}. If you do, create a 3/1 red Elemental creature token with trample and haste. Exile that token at the beginning of the next end step.");

export const AKOUM_STONEWAKER_SCRIPT: CardScript = {
  oracleId: AKOUM_STONEWAKER.oracleId,
  name: AKOUM_STONEWAKER.name,
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
      label: () => "Akoum Stonewaker - You may pay {2}{R}. If you do, create a 3/1 red Elemental creature token with trample and haste. Exile that token at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
