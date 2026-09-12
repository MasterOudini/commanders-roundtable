// `Kor Hookmaster` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KOR_HOOKMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOR_HOOKMASTER, "When this creature enters, tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.");

const VOCAB_L0 = vocabularyEffects("Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.", KOR_HOOKMASTER.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.");

export const KOR_HOOKMASTER_SCRIPT: CardScript = {
  oracleId: KOR_HOOKMASTER.oracleId,
  name: KOR_HOOKMASTER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Kor Hookmaster - Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
