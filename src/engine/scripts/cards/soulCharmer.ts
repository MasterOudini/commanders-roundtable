// `Soul Charmer` - a combatDamageCreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUL_CHARMER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOUL_CHARMER, "Whenever this creature deals combat damage to a creature, you gain 2 life unless that creature's controller pays {2}.");

const VOCAB_L0 = vocabularyEffects("You gain 2 life unless target player pays {2}.", SOUL_CHARMER.name);
const VOCAB_T_L0 = vocabularyTargets("You gain 2 life unless target player pays {2}.");

export const SOUL_CHARMER_SCRIPT: CardScript = {
  oracleId: SOUL_CHARMER.oracleId,
  name: SOUL_CHARMER.name,
  triggers: [
    {
      abilityId: 'combatDamageCreature-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx, self, ev) => {
        if (ev.t !== 'CombatDamageDealt') return null;
        const hit = ev.damages.find((d) => d.source === self && d.target.kind === 'card' && d.amount > 0);
        return hit ? (ctx.state.cards[hit.target.id]?.controller ?? null) : null;
      },
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'card' && d.amount > 0),
      label: () => "Soul Charmer - You gain 2 life unless target player pays {2}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
