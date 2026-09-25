// `Tana, the Bloodsower` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TANA_THE_BLOODSOWER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TANA_THE_BLOODSOWER, "Trample\nWhenever Tana deals combat damage to a player, create that many 1/1 green Saproling creature tokens.\nPartner (You can have two commanders if both have partner.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create that many 1/1 green Saproling creature tokens.", TANA_THE_BLOODSOWER.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Create that many 1/1 green Saproling creature tokens.");

export const TANA_THE_BLOODSOWER_SCRIPT: CardScript = {
  oracleId: TANA_THE_BLOODSOWER.oracleId,
  name: TANA_THE_BLOODSOWER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Tana, the Bloodsower - Create that many 1/1 green Saproling creature tokens.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
