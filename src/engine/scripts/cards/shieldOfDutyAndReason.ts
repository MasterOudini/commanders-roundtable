// `Shield of Duty and Reason` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHIELD_OF_DUTY_AND_REASON } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseProtection } from '../../../data/oracleParse';
import type { Protection } from '../../types/oracle';
import type { CardScript } from '../api';

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

const PRINTED = printed(SHIELD_OF_DUTY_AND_REASON, "Enchant creature\nEnchanted creature has protection from green and from blue.");
const LINES = PRINTED.split('\n');

function mergeProtection(a: Protection, b: Protection): Protection {
  return {
    colors: [...new Set([...a.colors, ...b.colors])],
    fromEverything: a.fromEverything || b.fromEverything,
    other: [...new Set([...a.other, ...b.other])],
  };
}

const PROT_1_0 = parseProtection("protection from green and from blue");

export const SHIELD_OF_DUTY_AND_REASON_SCRIPT: CardScript = {
  oracleId: SHIELD_OF_DUTY_AND_REASON.oracleId,
  name: SHIELD_OF_DUTY_AND_REASON.name,
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.protection = mergeProtection(chars.protection, PROT_1_0);
      },
    },
  ],
};
