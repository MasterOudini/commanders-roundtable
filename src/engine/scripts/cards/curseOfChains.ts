// `Curse of Chains` - a eachUpkeep trigger tapAttached
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CURSE_OF_CHAINS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(CURSE_OF_CHAINS, "Enchant creature\nAt the beginning of each upkeep, tap enchanted creature.");
const LINES = PRINTED.split('\n');

export const CURSE_OF_CHAINS_SCRIPT: CardScript = {
  oracleId: CURSE_OF_CHAINS.oracleId,
  name: CURSE_OF_CHAINS.name,
  triggers: [
    {
      abilityId: 'eachUpkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => "Curse of Chains - tapAttached",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [host] }];
      },
    },
  ],
};
