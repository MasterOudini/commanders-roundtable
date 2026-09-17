// `Elsha, Threefold Master` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELSHA_THREEFOLD_MASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELSHA_THREEFOLD_MASTER, "Trample\nProwess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nWhenever Elsha deals combat damage to a player, create that many 1/1 white Monk creature tokens with prowess.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Create that many 1/1 white Monk creature tokens with prowess.", ELSHA_THREEFOLD_MASTER.name, { memo: true });
const VOCAB_T_L2 = vocabularyTargets("Create that many 1/1 white Monk creature tokens with prowess.");

export const ELSHA_THREEFOLD_MASTER_SCRIPT: CardScript = {
  oracleId: ELSHA_THREEFOLD_MASTER.oracleId,
  name: ELSHA_THREEFOLD_MASTER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Elsha, Threefold Master - Create that many 1/1 white Monk creature tokens with prowess.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
