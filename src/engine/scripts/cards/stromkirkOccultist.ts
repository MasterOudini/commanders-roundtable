// `Stromkirk Occultist` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STROMKIRK_OCCULTIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STROMKIRK_OCCULTIST, "Trample\nWhenever this creature deals combat damage to a player, exile the top card of your library. Until end of turn, you may play that card.\nMadness {1}{R} (If you discard this card, discard it into exile. When you do, cast it for its madness cost or put it into your graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile the top card of your library. Until end of turn, you may play that card.", STROMKIRK_OCCULTIST.name);
const VOCAB_T_L1 = vocabularyTargets("Exile the top card of your library. Until end of turn, you may play that card.");

export const STROMKIRK_OCCULTIST_SCRIPT: CardScript = {
  oracleId: STROMKIRK_OCCULTIST.oracleId,
  name: STROMKIRK_OCCULTIST.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Stromkirk Occultist - Exile the top card of your library. Until end of turn, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
