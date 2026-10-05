// `Dreamtide Whale` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAMTIDE_WHALE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAMTIDE_WHALE, "Vanishing 2 (This creature enters with two time counters on it. At the beginning of your upkeep, remove a time counter from it. When the last is removed, sacrifice it.)\nWhenever a player casts their second spell each turn, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Proliferate.", DREAMTIDE_WHALE.name);
const VOCAB_T_L1 = vocabularyTargets("Proliferate.");

export const DREAMTIDE_WHALE_SCRIPT: CardScript = {
  oracleId: DREAMTIDE_WHALE.oracleId,
  name: DREAMTIDE_WHALE.name,
  triggers: [
    {
      abilityId: 'secondSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) => ev.t === 'SpellCast' && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Dreamtide Whale - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
