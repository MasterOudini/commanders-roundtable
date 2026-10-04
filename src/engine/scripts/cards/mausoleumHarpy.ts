// `Mausoleum Harpy` - a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAUSOLEUM_HARPY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAUSOLEUM_HARPY, "Flying\nAscend (If you control ten or more permanents, you get the city's blessing for the rest of the game.)\nWhenever another creature you control dies, if you have the city's blessing, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("If you have the city's blessing, put a +1/+1 counter on ~.", MAUSOLEUM_HARPY.name);
const VOCAB_T_L2 = vocabularyTargets("If you have the city's blessing, put a +1/+1 counter on ~.");

export const MAUSOLEUM_HARPY_SCRIPT: CardScript = {
  oracleId: MAUSOLEUM_HARPY.oracleId,
  name: MAUSOLEUM_HARPY.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Mausoleum Harpy - If you have the city's blessing, put a +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
