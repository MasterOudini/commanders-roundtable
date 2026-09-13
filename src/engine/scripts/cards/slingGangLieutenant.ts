// `Sling-Gang Lieutenant` - a etb trigger token, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLING_GANG_LIEUTENANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLING_GANG_LIEUTENANT, "When this creature enters, create two 1/1 red Goblin creature tokens.\nSacrifice a Goblin: Target player loses 1 life and you gain 1 life.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Goblin|1/1|R|Creature|");

const VOCAB_A0 = vocabularyEffects("Target player loses 1 life and you gain 1 life.", SLING_GANG_LIEUTENANT.name);
const VOCAB_T_A0 = vocabularyTargets("Target player loses 1 life and you gain 1 life.");

export const SLING_GANG_LIEUTENANT_SCRIPT: CardScript = {
  oracleId: SLING_GANG_LIEUTENANT.oracleId,
  name: SLING_GANG_LIEUTENANT.name,
  activated: [
    {
      ref: `${SLING_GANG_LIEUTENANT.oracleId}#a0`,
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
      label: () => "Sling-Gang Lieutenant - token",
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
