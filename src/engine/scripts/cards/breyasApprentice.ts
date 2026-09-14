// `Breya's Apprentice` - a etb trigger token, an activation vocab, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BREYA_S_APPRENTICE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(BREYA_S_APPRENTICE, "When this creature enters, create a 1/1 colorless Thopter artifact creature token with flying.\n{T}, Sacrifice an artifact: Choose one —\n• Exile the top card of your library. Until the end of your next turn, you may play that card.\n• Target creature gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Thopter|1/1||Artifact Creature|flying");

const MODES_A0 = [
  { text: "Exile the top card of your library. Until the end of your next turn, you may play that card.", targets: vocabularyTargets("Exile the top card of your library. Until the end of your next turn, you may play that card.") },
  { text: "Target creature gets +2/+0 until end of turn.", targets: vocabularyTargets("Target creature gets +2/+0 until end of turn.") },
];

const VOCAB_A0_m0 = vocabularyEffects("Exile the top card of your library. Until the end of your next turn, you may play that card.", BREYA_S_APPRENTICE.name);
const VOCAB_T_A0_m0 = vocabularyTargets("Exile the top card of your library. Until the end of your next turn, you may play that card.");

export const BREYAS_APPRENTICE_SCRIPT: CardScript = {
  oracleId: BREYA_S_APPRENTICE.oracleId,
  name: BREYA_S_APPRENTICE.name,
  activated: [
    {
      ref: `${BREYA_S_APPRENTICE.oracleId}#a0`,
      text: LINES[1] as string,
      modes: MODES_A0,
      modeChoice: { min: 1, max: 1 },
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_A0_m0, VOCAB_T_A0_m0);
        }
        if (chosen === 1) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0 }];
        }
        return [];
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
      label: () => "Breya's Apprentice - token",
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
