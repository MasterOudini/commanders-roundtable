// `Okiba-Gang Shinobi` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OKIBA_GANG_SHINOBI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OKIBA_GANG_SHINOBI, "Ninjutsu {3}{B} ({3}{B}, Return an unblocked attacker you control to hand: Put this card onto the battlefield from your hand tapped and attacking.)\nWhenever this creature deals combat damage to a player, that player discards two cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player discards two cards.", OKIBA_GANG_SHINOBI.name);
const VOCAB_T_L1 = vocabularyTargets("Target player discards two cards.");

export const OKIBA_GANG_SHINOBI_SCRIPT: CardScript = {
  oracleId: OKIBA_GANG_SHINOBI.oracleId,
  name: OKIBA_GANG_SHINOBI.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (_ctx, self, ev) => ((ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? (ev.damages.find((d) => d.source === self && d.target.kind === 'player' && d.amount > 0)?.target.id ?? null) : null),
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Okiba-Gang Shinobi - Target player discards two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L1.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
