// `Vanguard of Brimaz` - a heroic trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VANGUARD_OF_BRIMAZ } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const PRINTED = printed(VANGUARD_OF_BRIMAZ, "Vigilance\nHeroic — Whenever you cast a spell that targets this creature, create a 1/1 white Cat Soldier creature token with vigilance.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Cat Soldier|1/1|W|Creature|vigilance");

export const VANGUARD_OF_BRIMAZ_SCRIPT: CardScript = {
  oracleId: VANGUARD_OF_BRIMAZ.oracleId,
  name: VANGUARD_OF_BRIMAZ.name,
  triggers: [
    {
      abilityId: 'heroic-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Vanguard of Brimaz - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L1.oracleId,
          printingId: TOKEN_L1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
