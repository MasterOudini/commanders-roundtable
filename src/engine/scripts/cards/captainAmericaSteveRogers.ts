// `Captain America, Steve Rogers` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTAIN_AMERICA_STEVE_ROGERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAPTAIN_AMERICA_STEVE_ROGERS, "Lifelink (Damage dealt by this creature also causes you to gain that much life.)\nWhenever Captain America attacks, put a +1/+1 counter on another target creature you control. That creature gains indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on another target creature you control. That creature gains indestructible until end of turn.", CAPTAIN_AMERICA_STEVE_ROGERS.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on another target creature you control. That creature gains indestructible until end of turn.");

export const CAPTAIN_AMERICA_STEVE_ROGERS_SCRIPT: CardScript = {
  oracleId: CAPTAIN_AMERICA_STEVE_ROGERS.oracleId,
  name: CAPTAIN_AMERICA_STEVE_ROGERS.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Captain America, Steve Rogers - Put a +1/+1 counter on another target creature you control. That creature gains indestructible until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
