// `Aloe Alchemist` - a becomesPlotted trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALOE_ALCHEMIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALOE_ALCHEMIST, "Trample\nWhen this card becomes plotted, target creature gets +3/+2 and gains trample until end of turn.\nPlot {1}{G} (You may pay {1}{G} and exile this card from your hand. Cast it as a sorcery on a later turn without paying its mana cost. Plot only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature gets +3/+2 and gains trample until end of turn.", ALOE_ALCHEMIST.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature gets +3/+2 and gains trample until end of turn.");

export const ALOE_ALCHEMIST_SCRIPT: CardScript = {
  oracleId: ALOE_ALCHEMIST.oracleId,
  name: ALOE_ALCHEMIST.name,
  triggers: [
    {
      abilityId: 'becomesPlotted-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ["hand"],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'hand' && m.plottedTurn !== undefined),
      label: () => "Aloe Alchemist - Target creature gets +3/+2 and gains trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
