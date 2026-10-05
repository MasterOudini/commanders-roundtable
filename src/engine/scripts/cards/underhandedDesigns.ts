// `Underhanded Designs` - a artifactEnters trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNDERHANDED_DESIGNS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNDERHANDED_DESIGNS, "Whenever an artifact you control enters, you may pay {1}. If you do, each opponent loses 1 life and you gain 1 life.\n{1}{B}, Sacrifice this enchantment: Destroy target creature. Activate only if you control two or more artifacts.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, each opponent loses 1 life and you gain 1 life.", UNDERHANDED_DESIGNS.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, each opponent loses 1 life and you gain 1 life.");
const VOCAB_A0 = vocabularyEffects("Destroy target creature.", UNDERHANDED_DESIGNS.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target creature.");

export const UNDERHANDED_DESIGNS_SCRIPT: CardScript = {
  oracleId: UNDERHANDED_DESIGNS.oracleId,
  name: UNDERHANDED_DESIGNS.name,
  activated: [
    {
      ref: `${UNDERHANDED_DESIGNS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'artifactEnters-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Underhanded Designs - You may pay {1}. If you do, each opponent loses 1 life and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
