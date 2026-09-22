// `Whirler Virtuoso` - a etb trigger vocab, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WHIRLER_VIRTUOSO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WHIRLER_VIRTUOSO, "When this creature enters, you get {E}{E}{E} (three energy counters).\nPay {E}{E}{E}: Create a 1/1 colorless Thopter artifact creature token with flying.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Thopter|1/1||Artifact Creature|flying");

const VOCAB_L0 = vocabularyEffects("You get {E}{E}{E}.", WHIRLER_VIRTUOSO.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}{E}.");

export const WHIRLER_VIRTUOSO_SCRIPT: CardScript = {
  oracleId: WHIRLER_VIRTUOSO.oracleId,
  name: WHIRLER_VIRTUOSO.name,
  activated: [
    {
      ref: `${WHIRLER_VIRTUOSO.oracleId}#a0`,
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
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Whirler Virtuoso - You get {E}{E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
