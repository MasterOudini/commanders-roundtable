// `Vital Splicer` - a etb trigger token, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VITAL_SPLICER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VITAL_SPLICER, "When this creature enters, create a 3/3 colorless Phyrexian Golem artifact creature token.\n{1}: Regenerate target Golem you control.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Phyrexian Golem|3/3||Artifact Creature|");

const VOCAB_A0 = vocabularyEffects("Regenerate target Golem you control.", VITAL_SPLICER.name);
const VOCAB_T_A0 = vocabularyTargets("Regenerate target Golem you control.");

export const VITAL_SPLICER_SCRIPT: CardScript = {
  oracleId: VITAL_SPLICER.oracleId,
  name: VITAL_SPLICER.name,
  activated: [
    {
      ref: `${VITAL_SPLICER.oracleId}#a0`,
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
      label: () => "Vital Splicer - token",
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
