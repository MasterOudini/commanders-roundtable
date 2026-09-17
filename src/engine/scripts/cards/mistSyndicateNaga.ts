// `Mist-Syndicate Naga` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MIST_SYNDICATE_NAGA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIST_SYNDICATE_NAGA, "Ninjutsu {2}{U} ({2}{U}, Return an unblocked attacker you control to hand: Put this card onto the battlefield from your hand tapped and attacking.)\nWhenever this creature deals combat damage to a player, create a token that's a copy of this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a token that's a copy of this creature.", MIST_SYNDICATE_NAGA.name);
const VOCAB_T_L1 = vocabularyTargets("Create a token that's a copy of this creature.");

export const MIST_SYNDICATE_NAGA_SCRIPT: CardScript = {
  oracleId: MIST_SYNDICATE_NAGA.oracleId,
  name: MIST_SYNDICATE_NAGA.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Mist-Syndicate Naga - Create a token that's a copy of this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
