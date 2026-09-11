// `Stronghold Rats` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STRONGHOLD_RATS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STRONGHOLD_RATS, "Shadow (This creature can block or be blocked by only creatures with shadow.)\nWhenever this creature deals combat damage to a player, each player discards a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each player discards a card.", STRONGHOLD_RATS.name);
const VOCAB_T_L1 = vocabularyTargets("Each player discards a card.");

export const STRONGHOLD_RATS_SCRIPT: CardScript = {
  oracleId: STRONGHOLD_RATS.oracleId,
  name: STRONGHOLD_RATS.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Stronghold Rats - Each player discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
