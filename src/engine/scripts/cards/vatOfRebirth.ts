// `Vat of Rebirth` - a cardPutIntoGraveyard trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VAT_OF_REBIRTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VAT_OF_REBIRTH, "Whenever another artifact or creature you control is put into a graveyard from the battlefield, put an oil counter on this artifact.\n{2}{B}, {T}, Remove four oil counters from this artifact: Return target creature card from your graveyard to the battlefield. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put an oil counter on this artifact.", VAT_OF_REBIRTH.name);
const VOCAB_T_L0 = vocabularyTargets("Put an oil counter on this artifact.");
const VOCAB_A0 = vocabularyEffects("Return target creature card from your graveyard to the battlefield.", VAT_OF_REBIRTH.name);
const VOCAB_T_A0 = vocabularyTargets("Return target creature card from your graveyard to the battlefield.");

export const VAT_OF_REBIRTH_SCRIPT: CardScript = {
  oracleId: VAT_OF_REBIRTH.oracleId,
  name: VAT_OF_REBIRTH.name,
  activated: [
    {
      ref: `${VAT_OF_REBIRTH.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && m.card !== self && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (ctx.derive(m.card).typeLine.types.includes('Artifact') || ctx.derive(m.card).typeLine.types.includes('Creature')),
        ),
      label: () => "Vat of Rebirth - Put an oil counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
