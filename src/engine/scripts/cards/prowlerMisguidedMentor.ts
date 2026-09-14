// `Prowler, Misguided Mentor` - a static cantBeBlockedByPower, a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROWLER_MISGUIDED_MENTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROWLER_MISGUIDED_MENTOR, "Prowler can't be blocked by creatures with power 2 or less.\nWhenever Prowler deals combat damage to a player, put a +1/+1 counter on another target creature you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on another target creature you control.", PROWLER_MISGUIDED_MENTOR.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on another target creature you control.");

export const PROWLER_MISGUIDED_MENTOR_SCRIPT: CardScript = {
  oracleId: PROWLER_MISGUIDED_MENTOR.oracleId,
  name: PROWLER_MISGUIDED_MENTOR.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Prowler, Misguided Mentor - Put a +1/+1 counter on another target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
