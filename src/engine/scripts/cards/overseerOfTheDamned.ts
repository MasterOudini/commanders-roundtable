// `Overseer of the Damned` - a etb trigger vocab, a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OVERSEER_OF_THE_DAMNED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OVERSEER_OF_THE_DAMNED, "Flying\nWhen this creature enters, you may destroy target creature.\nWhenever a nontoken creature an opponent controls dies, create a tapped 2/2 black Zombie creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target creature.", OVERSEER_OF_THE_DAMNED.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target creature.");
const VOCAB_L2 = vocabularyEffects("Create a tapped 2/2 black Zombie creature token.", OVERSEER_OF_THE_DAMNED.name);
const VOCAB_T_L2 = vocabularyTargets("Create a tapped 2/2 black Zombie creature token.");

export const OVERSEER_OF_THE_DAMNED_SCRIPT: CardScript = {
  oracleId: OVERSEER_OF_THE_DAMNED.oracleId,
  name: OVERSEER_OF_THE_DAMNED.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Overseer of the Damned - Destroy target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'aCreatureDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Overseer of the Damned - Create a tapped 2/2 black Zombie creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
