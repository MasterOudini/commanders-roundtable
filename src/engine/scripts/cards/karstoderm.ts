// `Karstoderm` - a static entersWithCounters, a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KARSTODERM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KARSTODERM, "This creature enters with five +1/+1 counters on it.\nWhenever an artifact enters, remove a +1/+1 counter from this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Remove a +1/+1 counter from this creature.", KARSTODERM.name);
const VOCAB_T_L1 = vocabularyTargets("Remove a +1/+1 counter from this creature.");

export const KARSTODERM_SCRIPT: CardScript = {
  oracleId: KARSTODERM.oracleId,
  name: KARSTODERM.name,
  triggers: [
    {
      abilityId: 'creatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Karstoderm - Remove a +1/+1 counter from this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 5 }] }],
    },
  ],
};
