// `Jeskai Monument` - a etb trigger vocab, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JESKAI_MONUMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JESKAI_MONUMENT, "When this artifact enters, search your library for a basic Island, Mountain, or Plains card, reveal it, put it into your hand, then shuffle.\n{1}{U}{R}{W}, {T}, Sacrifice this artifact: Create two 1/1 white Bird creature tokens with flying. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Bird|1/1|W|Creature|flying");

const VOCAB_L0 = vocabularyEffects("Search your library for a basic Island, Mountain, or Plains card, reveal it, put it into your hand, then shuffle.", JESKAI_MONUMENT.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic Island, Mountain, or Plains card, reveal it, put it into your hand, then shuffle.");

export const JESKAI_MONUMENT_SCRIPT: CardScript = {
  oracleId: JESKAI_MONUMENT.oracleId,
  name: JESKAI_MONUMENT.name,
  activated: [
    {
      ref: `${JESKAI_MONUMENT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
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
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Jeskai Monument - Search your library for a basic Island, Mountain, or Plains card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
