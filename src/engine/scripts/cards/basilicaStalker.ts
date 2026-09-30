// `Basilica Stalker` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BASILICA_STALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BASILICA_STALKER, "Flying\nWhenever this creature deals combat damage to a player, you gain 1 life and surveil 1. (Look at the top card of your library. You may put it into your graveyard.)\nDisguise {4}{B} (You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You gain 1 life and surveil 1.", BASILICA_STALKER.name);
const VOCAB_T_L1 = vocabularyTargets("You gain 1 life and surveil 1.");

export const BASILICA_STALKER_SCRIPT: CardScript = {
  oracleId: BASILICA_STALKER.oracleId,
  name: BASILICA_STALKER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Basilica Stalker - You gain 1 life and surveil 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
