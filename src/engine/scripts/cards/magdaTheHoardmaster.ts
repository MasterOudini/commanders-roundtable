// `Magda, the Hoardmaster` - a youCommitCrime trigger vocab, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAGDA_THE_HOARDMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAGDA_THE_HOARDMASTER, "Whenever you commit a crime, create a tapped Treasure token. This ability triggers only once each turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)\nSacrifice three Treasures: Create a 4/4 red Scorpion Dragon creature token with flying and haste. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Scorpion Dragon|4/4|R|Creature|flying|haste");

const VOCAB_L0 = vocabularyEffects("Create a tapped Treasure token.", MAGDA_THE_HOARDMASTER.name);
const VOCAB_T_L0 = vocabularyTargets("Create a tapped Treasure token.");

export const MAGDA_THE_HOARDMASTER_SCRIPT: CardScript = {
  oracleId: MAGDA_THE_HOARDMASTER.oracleId,
  name: MAGDA_THE_HOARDMASTER.name,
  activated: [
    {
      ref: `${MAGDA_THE_HOARDMASTER.oracleId}#a0`,
      text: LINES[1] as string,
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
      abilityId: 'youCommitCrime-0',
      text: LINES[0] as string,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Magda, the Hoardmaster - Create a tapped Treasure token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
