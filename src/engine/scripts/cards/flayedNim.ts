// `Flayed Nim` - a combatDamageCreature trigger vocab, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLAYED_NIM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLAYED_NIM, "Whenever this creature deals combat damage to a creature, that creature's controller loses that much life.\n{2}{B}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target player loses that much life.", FLAYED_NIM.name, { memo: true });
const VOCAB_T_L0 = vocabularyTargets("Target player loses that much life.");

export const FLAYED_NIM_SCRIPT: CardScript = {
  oracleId: FLAYED_NIM.oracleId,
  name: FLAYED_NIM.name,
  activated: [
    {
      ref: `${FLAYED_NIM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'combatDamageCreature-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.source === self && d.target.kind === 'card').reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      playerOf: (ctx, self, ev) => {
        if (ev.t !== 'CombatDamageDealt') return null;
        const hit = ev.damages.find((d) => d.source === self && d.target.kind === 'card' && d.amount > 0);
        return hit ? (ctx.state.cards[hit.target.id]?.controller ?? null) : null;
      },
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'card' && d.amount > 0),
      label: () => "Flayed Nim - Target player loses that much life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
