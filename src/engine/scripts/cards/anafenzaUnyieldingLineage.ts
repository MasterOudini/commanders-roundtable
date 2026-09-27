// `Anafenza, Unyielding Lineage` - a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANAFENZA_UNYIELDING_LINEAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANAFENZA_UNYIELDING_LINEAGE, "Flash\nFirst strike\nWhenever another nontoken creature you control dies, Anafenza endures 2. (Put two +1/+1 counters on it or create a 2/2 white Spirit creature token.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("~ endures 2.", ANAFENZA_UNYIELDING_LINEAGE.name);
const VOCAB_T_L2 = vocabularyTargets("~ endures 2.");

export const ANAFENZA_UNYIELDING_LINEAGE_SCRIPT: CardScript = {
  oracleId: ANAFENZA_UNYIELDING_LINEAGE.oracleId,
  name: ANAFENZA_UNYIELDING_LINEAGE.name,
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
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Anafenza, Unyielding Lineage - ~ endures 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
