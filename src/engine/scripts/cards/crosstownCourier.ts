// `Crosstown Courier` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CROSSTOWN_COURIER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CROSSTOWN_COURIER, "Whenever this creature deals combat damage to a player, that player mills that many cards.");

const VOCAB_L0 = vocabularyEffects("Target player mills that many cards.", CROSSTOWN_COURIER.name, { memo: true });
const VOCAB_T_L0 = vocabularyTargets("Target player mills that many cards.");

export const CROSSTOWN_COURIER_SCRIPT: CardScript = {
  oracleId: CROSSTOWN_COURIER.oracleId,
  name: CROSSTOWN_COURIER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      playerOf: (_ctx, self, ev) => ((ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? (ev.damages.find((d) => d.source === self && d.target.kind === 'player' && d.amount > 0)?.target.id ?? null) : null),
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Crosstown Courier - Target player mills that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
