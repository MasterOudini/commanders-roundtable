// `Rapacious One` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAPACIOUS_ONE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAPACIOUS_ONE, "Trample\nWhenever this creature deals combat damage to a player, create that many 0/1 colorless Eldrazi Spawn creature tokens. They have \"Sacrifice this token: Add {C}.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create that many 0/1 colorless Eldrazi Spawn creature tokens. They have \"Sacrifice this token: Add {C}.\"", RAPACIOUS_ONE.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Create that many 0/1 colorless Eldrazi Spawn creature tokens. They have \"Sacrifice this token: Add {C}.\"");

export const RAPACIOUS_ONE_SCRIPT: CardScript = {
  oracleId: RAPACIOUS_ONE.oracleId,
  name: RAPACIOUS_ONE.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Rapacious One - Create that many 0/1 colorless Eldrazi Spawn creature tokens. They have \"Sacrifice this token: Add {C}.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
