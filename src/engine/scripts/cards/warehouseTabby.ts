// `Warehouse Tabby` - a cardPutIntoGraveyard trigger vocab, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAREHOUSE_TABBY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WAREHOUSE_TABBY, "Whenever an enchantment you control is put into a graveyard from the battlefield, create a 1/1 black Rat creature token with \"This token can't block.\"\n{1}{B}: This creature gains deathtouch until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create a 1/1 black Rat creature token with \"This token can't block.\"", WAREHOUSE_TABBY.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 1/1 black Rat creature token with \"This token can't block.\"");

export const WAREHOUSE_TABBY_SCRIPT: CardScript = {
  oracleId: WAREHOUSE_TABBY.oracleId,
  name: WAREHOUSE_TABBY.name,
  activated: [
    {
      ref: `${WAREHOUSE_TABBY.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
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
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Enchantment'),
        ),
      label: () => "Warehouse Tabby - Create a 1/1 black Rat creature token with \"This token can't block.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
