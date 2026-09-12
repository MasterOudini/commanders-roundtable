// `Dusk Rose Reliquary` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUSK_ROSE_RELIQUARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUSK_ROSE_RELIQUARY, "As an additional cost to cast this spell, sacrifice an artifact or creature.\nWard {2}\nWhen this artifact enters, exile target artifact or creature an opponent controls until this artifact leaves the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Exile target artifact or creature an opponent controls until this artifact leaves the battlefield.", DUSK_ROSE_RELIQUARY.name);
const VOCAB_T_L2 = vocabularyTargets("Exile target artifact or creature an opponent controls until this artifact leaves the battlefield.");

export const DUSK_ROSE_RELIQUARY_SCRIPT: CardScript = {
  oracleId: DUSK_ROSE_RELIQUARY.oracleId,
  name: DUSK_ROSE_RELIQUARY.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Dusk Rose Reliquary - Exile target artifact or creature an opponent controls until this artifact leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
