// `Belfry Spirit` - a etb trigger token, a hauntedDies trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BELFRY_SPIRIT } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { hauntedDied } from '../../keywordTriggers';
import type { CardData } from '../../../data/cardTypes';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(BELFRY_SPIRIT, "Flying\nHaunt (When this creature dies, exile it haunting target creature.)\nWhen this creature enters or the creature it haunts dies, create two 1/1 black Bat creature tokens with flying.");
const LINES = PRINTED.split('\n');
const TOKEN_L2 = tokenRef("Bat|1/1|B|Creature|flying");

export const BELFRY_SPIRIT_SCRIPT: CardScript = {
  oracleId: BELFRY_SPIRIT.oracleId,
  name: BELFRY_SPIRIT.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Belfry Spirit - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L2.oracleId,
          printingId: TOKEN_L2.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
    {
      abilityId: 'hauntedDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ["exile"],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) => hauntedDied(ctx, self, ev),
      label: () => "Belfry Spirit - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L2.oracleId,
          printingId: TOKEN_L2.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
