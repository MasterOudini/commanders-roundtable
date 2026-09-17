// `Aquatic Incursion` - a etb trigger token, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AQUATIC_INCURSION } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(AQUATIC_INCURSION, "When this enchantment enters, create two 1/1 blue Merfolk creature tokens with hexproof. (They can't be the targets of spells or abilities your opponents control.)\n{3}{U}: Target Merfolk can't be blocked this turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Merfolk|1/1|U|Creature|hexproof");

const VOCAB_A0 = vocabularyEffects("Target Merfolk can't be blocked this turn.", AQUATIC_INCURSION.name);
const VOCAB_T_A0 = vocabularyTargets("Target Merfolk can't be blocked this turn.");

export const AQUATIC_INCURSION_SCRIPT: CardScript = {
  oracleId: AQUATIC_INCURSION.oracleId,
  name: AQUATIC_INCURSION.name,
  activated: [
    {
      ref: `${AQUATIC_INCURSION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Aquatic Incursion - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
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
