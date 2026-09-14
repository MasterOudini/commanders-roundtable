// `Salvage Drone` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SALVAGE_DRONE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SALVAGE_DRONE, "Devoid (This card has no color.)\nIngest (Whenever this creature deals combat damage to a player, that player exiles the top card of their library.)\nWhen this creature dies, you may draw a card. If you do, discard a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Draw a card. If you do, discard a card.", SALVAGE_DRONE.name);
const VOCAB_T_L2 = vocabularyTargets("Draw a card. If you do, discard a card.");

export const SALVAGE_DRONE_SCRIPT: CardScript = {
  oracleId: SALVAGE_DRONE.oracleId,
  name: SALVAGE_DRONE.name,
  triggers: [
    {
      abilityId: 'dies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Salvage Drone - Draw a card. If you do, discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
