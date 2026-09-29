// `Unscrupulous Contractor` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNSCRUPULOUS_CONTRACTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNSCRUPULOUS_CONTRACTOR, "When this creature enters, you may sacrifice a creature. When you do, target player draws two cards and loses 2 life.\nPlot {2}{B} (You may pay {2}{B} and exile this card from your hand. Cast it as a sorcery on a later turn without paying its mana cost. Plot only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may sacrifice a creature. When you do, target player draws two cards and loses 2 life.", UNSCRUPULOUS_CONTRACTOR.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice a creature. When you do, target player draws two cards and loses 2 life.");

export const UNSCRUPULOUS_CONTRACTOR_SCRIPT: CardScript = {
  oracleId: UNSCRUPULOUS_CONTRACTOR.oracleId,
  name: UNSCRUPULOUS_CONTRACTOR.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Unscrupulous Contractor - You may sacrifice a creature. When you do, target player draws two cards and loses 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
