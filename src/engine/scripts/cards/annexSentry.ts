// `Annex Sentry` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANNEX_SENTRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANNEX_SENTRY, "Toxic 1 (Players dealt combat damage by this creature also get a poison counter.)\nWhen this creature enters, exile target artifact or creature an opponent controls with mana value 3 or less until this creature leaves the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile target artifact or creature an opponent controls with mana value 3 or less until this creature leaves the battlefield.", ANNEX_SENTRY.name);
const VOCAB_T_L1 = vocabularyTargets("Exile target artifact or creature an opponent controls with mana value 3 or less until this creature leaves the battlefield.");

export const ANNEX_SENTRY_SCRIPT: CardScript = {
  oracleId: ANNEX_SENTRY.oracleId,
  name: ANNEX_SENTRY.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Annex Sentry - Exile target artifact or creature an opponent controls with mana value 3 or less until this creature leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
