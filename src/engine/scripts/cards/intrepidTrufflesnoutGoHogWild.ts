// `Intrepid Trufflesnout // Go Hog Wild` - a attacksAlone trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INTREPID_TRUFFLESNOUT_GO_HOG_WILD } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(INTREPID_TRUFFLESNOUT_GO_HOG_WILD, "Whenever this creature attacks alone, create a Food token. (It's an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")\nTarget creature gets +2/+2 until end of turn. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Food|/||Artifact|");

export const INTREPID_TRUFFLESNOUT_GO_HOG_WILD_SCRIPT: CardScript = {
  oracleId: INTREPID_TRUFFLESNOUT_GO_HOG_WILD.oracleId,
  name: INTREPID_TRUFFLESNOUT_GO_HOG_WILD.name,
  triggers: [
    {
      abilityId: 'attacksAlone-0', face: 0,
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.length === 1 && ev.attackers[0]?.card === self,
      label: () => "Intrepid Trufflesnout // Go Hog Wild - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
