// `Crossroads Candleguide` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CROSSROADS_CANDLEGUIDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CROSSROADS_CANDLEGUIDE, "When this creature enters, exile up to one target card from a graveyard.\n{2}: Add one mana of any color.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile up to one target card from a graveyard.", CROSSROADS_CANDLEGUIDE.name);
const VOCAB_T_L0 = vocabularyTargets("Exile up to one target card from a graveyard.");

export const CROSSROADS_CANDLEGUIDE_SCRIPT: CardScript = {
  oracleId: CROSSROADS_CANDLEGUIDE.oracleId,
  name: CROSSROADS_CANDLEGUIDE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Crossroads Candleguide - Exile up to one target card from a graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
