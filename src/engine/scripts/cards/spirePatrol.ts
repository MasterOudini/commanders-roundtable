// `Spire Patrol` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIRE_PATROL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIRE_PATROL, "Flying\nWhen this creature enters, tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.", SPIRE_PATROL.name);
const VOCAB_T_L1 = vocabularyTargets("Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.");

export const SPIRE_PATROL_SCRIPT: CardScript = {
  oracleId: SPIRE_PATROL.oracleId,
  name: SPIRE_PATROL.name,
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
      label: () => "Spire Patrol - Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
