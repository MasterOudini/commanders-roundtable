// `Wall of Vapor` - a CONTINUOUS prevention effect (CR 615, D385): a `PreventionDef` the
// replacement funnel asks about every damage entry, which absorbs the whole entry and spends
// nothing - the other half of D382 one-shot shield. Generated from one table row.

import { WALL_OF_VAPOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WALL_OF_VAPOR, "Defender (This creature can't attack.)\nPrevent all damage that would be dealt to this creature by creatures it's blocking.");
const LINES = PRINTED.split(String.fromCharCode(10));

export const WALL_OF_VAPOR_SCRIPT: CardScript = {
  oracleId: WALL_OF_VAPOR.oracleId,
  name: WALL_OF_VAPOR.name,
  prevention: [
    {
      abilityId: 'prevent-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 615 - asked in the funnel per damage entry; a true absorbs the entry whole.
      prevents: (ctx, self, entry, _isCombat) => {
        const tid = entry.target.kind === 'card' ? entry.target.id : null;
        const src = entry.source;
        return (tid === self) && ((ctx.state.combat?.blockers.some((b) => b.card === self && b.attackerOrder.includes(src)) ?? false));
      },
    },
  ],
};
