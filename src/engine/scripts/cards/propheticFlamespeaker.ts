// `Prophetic Flamespeaker` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROPHETIC_FLAMESPEAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROPHETIC_FLAMESPEAKER, "Double strike, trample\nWhenever this creature deals combat damage to a player, exile the top card of your library. You may play it this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile the top card of your library. You may play it this turn.", PROPHETIC_FLAMESPEAKER.name);
const VOCAB_T_L1 = vocabularyTargets("Exile the top card of your library. You may play it this turn.");

export const PROPHETIC_FLAMESPEAKER_SCRIPT: CardScript = {
  oracleId: PROPHETIC_FLAMESPEAKER.oracleId,
  name: PROPHETIC_FLAMESPEAKER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Prophetic Flamespeaker - Exile the top card of your library. You may play it this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
