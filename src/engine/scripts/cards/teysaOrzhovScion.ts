// `Teysa, Orzhov Scion` - an activation vocab, a anotherCreatureDies trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEYSA_ORZHOV_SCION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TEYSA_ORZHOV_SCION, "Sacrifice three white creatures: Exile target creature.\nWhenever another black creature you control dies, create a 1/1 white Spirit creature token with flying.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Spirit|1/1|W|Creature|flying");

const VOCAB_A0 = vocabularyEffects("Exile target creature.", TEYSA_ORZHOV_SCION.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target creature.");

export const TEYSA_ORZHOV_SCION_SCRIPT: CardScript = {
  oracleId: TEYSA_ORZHOV_SCION.oracleId,
  name: TEYSA_ORZHOV_SCION.name,
  activated: [
    {
      ref: `${TEYSA_ORZHOV_SCION.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'anotherCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && ctx.derive(m.card).colors.includes('B'),
        ),
      label: () => "Teysa, Orzhov Scion - token",
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
