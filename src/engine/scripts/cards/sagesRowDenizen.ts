// `Sage's Row Denizen` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAGE_S_ROW_DENIZEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAGE_S_ROW_DENIZEN, "Whenever another blue creature you control enters, target player mills two cards.");

const VOCAB_L0 = vocabularyEffects("Target player mills two cards.", SAGE_S_ROW_DENIZEN.name);
const VOCAB_T_L0 = vocabularyTargets("Target player mills two cards.");

export const SAGES_ROW_DENIZEN_SCRIPT: CardScript = {
  oracleId: SAGE_S_ROW_DENIZEN.oracleId,
  name: SAGE_S_ROW_DENIZEN.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && ctx.derive(m.card).colors.includes('U'),
        ),
      label: () => "Sage's Row Denizen - Target player mills two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
