// `Professor Hulk` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROFESSOR_HULK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROFESSOR_HULK, "Trample\nWhenever Professor Hulk deals combat damage to a player, draw that many cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Draw that many cards.", PROFESSOR_HULK.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Draw that many cards.");

export const PROFESSOR_HULK_SCRIPT: CardScript = {
  oracleId: PROFESSOR_HULK.oracleId,
  name: PROFESSOR_HULK.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Professor Hulk - Draw that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
