// `Pia Nalaar` - a etb trigger token, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PIA_NALAAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PIA_NALAAR, "When Pia Nalaar enters, create a 1/1 colorless Thopter artifact creature token with flying.\n{1}{R}: Target artifact creature gets +1/+0 until end of turn.\n{1}, Sacrifice an artifact: Target creature can't block this turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Thopter|1/1||Artifact Creature|flying");

const VOCAB_A0 = vocabularyEffects("Target artifact creature gets +1/+0 until end of turn.", PIA_NALAAR.name);
const VOCAB_T_A0 = vocabularyTargets("Target artifact creature gets +1/+0 until end of turn.");
const VOCAB_A1 = vocabularyEffects("Target creature can't block this turn.", PIA_NALAAR.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature can't block this turn.");

export const PIA_NALAAR_SCRIPT: CardScript = {
  oracleId: PIA_NALAAR.oracleId,
  name: PIA_NALAAR.name,
  activated: [
    {
      ref: `${PIA_NALAAR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${PIA_NALAAR.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
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
      label: () => "Pia Nalaar - token",
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
