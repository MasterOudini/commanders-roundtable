// `Fog Bank` - a CONTINUOUS prevention effect (CR 615, D385): a `PreventionDef` the
// replacement funnel asks about every damage entry, which absorbs the whole entry and spends
// nothing - the other half of D382 one-shot shield. Generated from one table row.

import { FOG_BANK } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(FOG_BANK, "Defender (This creature can't attack.)\nFlying\nPrevent all combat damage that would be dealt to and dealt by this creature.");
const LINES = PRINTED.split(String.fromCharCode(10));

export const FOG_BANK_SCRIPT: CardScript = {
  oracleId: FOG_BANK.oracleId,
  name: FOG_BANK.name,
  prevention: [
    {
      abilityId: 'prevent-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      // CR 615 - asked in the funnel per damage entry; a true absorbs the entry whole.
      prevents: (_ctx, self, entry, isCombat) => {
        if (!isCombat) return false;
        const tid = entry.target.kind === 'card' ? entry.target.id : null;
        const src = entry.source;
        return (tid === self) || (src === self);
      },
    },
  ],
};
