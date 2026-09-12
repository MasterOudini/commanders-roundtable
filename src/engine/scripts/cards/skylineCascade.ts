// `Skyline Cascade` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYLINE_CASCADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYLINE_CASCADE, "This land enters tapped.\nWhen this land enters, target creature an opponent controls doesn't untap during its controller's next untap step.\n{T}: Add {U}.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature an opponent controls doesn't untap during its controller's next untap step.", SKYLINE_CASCADE.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature an opponent controls doesn't untap during its controller's next untap step.");

export const SKYLINE_CASCADE_SCRIPT: CardScript = {
  oracleId: SKYLINE_CASCADE.oracleId,
  name: SKYLINE_CASCADE.name,
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
      label: () => "Skyline Cascade - Target creature an opponent controls doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
