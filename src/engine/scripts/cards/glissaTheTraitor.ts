// `Glissa, the Traitor` - a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLISSA_THE_TRAITOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLISSA_THE_TRAITOR, "First strike, deathtouch\nWhenever a creature an opponent controls dies, you may return target artifact card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target artifact card from your graveyard to your hand.", GLISSA_THE_TRAITOR.name);
const VOCAB_T_L1 = vocabularyTargets("Return target artifact card from your graveyard to your hand.");

export const GLISSA_THE_TRAITOR_SCRIPT: CardScript = {
  oracleId: GLISSA_THE_TRAITOR.oracleId,
  name: GLISSA_THE_TRAITOR.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Glissa, the Traitor - Return target artifact card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
