// `Coliseum Behemoth` - a etb trigger vocab, a etb trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COLISEUM_BEHEMOTH } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(COLISEUM_BEHEMOTH, "Trample\nWhen this creature enters, choose one —\n• Destroy target artifact or enchantment.\n• Draw a card.");
const LINES = PRINTED.split('\n');

const MODES_L1 = [
  { text: "Destroy target artifact or enchantment.", targets: vocabularyTargets("Destroy target artifact or enchantment.") },
  { text: "Draw a card.", targets: vocabularyTargets("Draw a card.") },
];

const VOCAB_L1_m0 = vocabularyEffects("Destroy target artifact or enchantment.", COLISEUM_BEHEMOTH.name);
const VOCAB_T_L1_m0 = vocabularyTargets("Destroy target artifact or enchantment.");

export const COLISEUM_BEHEMOTH_SCRIPT: CardScript = {
  oracleId: COLISEUM_BEHEMOTH.oracleId,
  name: COLISEUM_BEHEMOTH.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L1,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Coliseum Behemoth - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L1_m0, VOCAB_T_L1_m0);
        }
        if (chosen === 1) {
          return drawEvents(ctx.state, obj.controller, 1);
        }
        return [];
      },
    },
  ],
};
