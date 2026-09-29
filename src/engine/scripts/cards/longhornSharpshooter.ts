// `Longhorn Sharpshooter` - a becomesPlotted trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LONGHORN_SHARPSHOOTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LONGHORN_SHARPSHOOTER, "Reach\nWhen this card becomes plotted, it deals 2 damage to any target.\nPlot {3}{R} (You may pay {3}{R} and exile this card from your hand. Cast it as a sorcery on a later turn without paying its mana cost. Plot only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("It deals 2 damage to any target.", LONGHORN_SHARPSHOOTER.name);
const VOCAB_T_L1 = vocabularyTargets("It deals 2 damage to any target.");

export const LONGHORN_SHARPSHOOTER_SCRIPT: CardScript = {
  oracleId: LONGHORN_SHARPSHOOTER.oracleId,
  name: LONGHORN_SHARPSHOOTER.name,
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
      label: () => "Longhorn Sharpshooter - It deals 2 damage to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
