// `Avenger of Zendikar` - a etb trigger vocab, a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVENGER_OF_ZENDIKAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVENGER_OF_ZENDIKAR, "When this creature enters, create a 0/1 green Plant creature token for each land you control.\nLandfall — Whenever a land you control enters, you may put a +1/+1 counter on each Plant creature you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create a 0/1 green Plant creature token for each land you control.", AVENGER_OF_ZENDIKAR.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 0/1 green Plant creature token for each land you control.");
const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on each Plant creature you control.", AVENGER_OF_ZENDIKAR.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on each Plant creature you control.");

export const AVENGER_OF_ZENDIKAR_SCRIPT: CardScript = {
  oracleId: AVENGER_OF_ZENDIKAR.oracleId,
  name: AVENGER_OF_ZENDIKAR.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Avenger of Zendikar - Create a 0/1 green Plant creature token for each land you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'landfall-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Avenger of Zendikar - Put a +1/+1 counter on each Plant creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
