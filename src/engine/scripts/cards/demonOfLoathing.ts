// `Demon of Loathing` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEMON_OF_LOATHING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEMON_OF_LOATHING, "Flying, trample\nWhenever this creature deals combat damage to a player, that player sacrifices a creature of their choice.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player sacrifices a creature of target player's choice.", DEMON_OF_LOATHING.name);
const VOCAB_T_L1 = vocabularyTargets("Target player sacrifices a creature of target player's choice.");

export const DEMON_OF_LOATHING_SCRIPT: CardScript = {
  oracleId: DEMON_OF_LOATHING.oracleId,
  name: DEMON_OF_LOATHING.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (_ctx, self, ev) => ((ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? (ev.damages.find((d) => d.source === self && d.target.kind === 'player' && d.amount > 0)?.target.id ?? null) : null),
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Demon of Loathing - Target player sacrifices a creature of target player's choice.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L1.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
