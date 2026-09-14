// `Origin Spellbomb` - an activation token, a auraToGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORIGIN_SPELLBOMB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORIGIN_SPELLBOMB, "{1}, {T}, Sacrifice this artifact: Create a 1/1 colorless Myr artifact creature token.\nWhen this artifact is put into a graveyard from the battlefield, you may pay {W}. If you do, draw a card.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Myr|1/1||Artifact Creature|");

const VOCAB_L1 = vocabularyEffects("You may pay {W}. If you do, draw a card.", ORIGIN_SPELLBOMB.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {W}. If you do, draw a card.");

export const ORIGIN_SPELLBOMB_SCRIPT: CardScript = {
  oracleId: ORIGIN_SPELLBOMB.oracleId,
  name: ORIGIN_SPELLBOMB.name,
  activated: [
    {
      ref: `${ORIGIN_SPELLBOMB.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  triggers: [
    {
      abilityId: 'auraToGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Origin Spellbomb - You may pay {W}. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
