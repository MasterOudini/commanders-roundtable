// `Thundering Broodwagon` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THUNDERING_BROODWAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THUNDERING_BROODWAGON, "Menace, reach\nWhen this Vehicle enters, destroy target nonland permanent an opponent controls with mana value 4 or less.\nCrew 3\nCycling {2} ({2}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target nonland permanent an opponent controls with mana value 4 or less.", THUNDERING_BROODWAGON.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target nonland permanent an opponent controls with mana value 4 or less.");

export const THUNDERING_BROODWAGON_SCRIPT: CardScript = {
  oracleId: THUNDERING_BROODWAGON.oracleId,
  name: THUNDERING_BROODWAGON.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Thundering Broodwagon - Destroy target nonland permanent an opponent controls with mana value 4 or less.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
