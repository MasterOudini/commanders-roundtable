// `Foundry Champion` - a etb trigger vocab, an activation pumping itself, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FOUNDRY_CHAMPION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FOUNDRY_CHAMPION, "When this creature enters, it deals damage to any target equal to the number of creatures you control.\n{R}: This creature gets +1/+0 until end of turn.\n{W}: This creature gets +0/+1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ deals damage to any target equal to the number of creatures you control.", FOUNDRY_CHAMPION.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals damage to any target equal to the number of creatures you control.");

export const FOUNDRY_CHAMPION_SCRIPT: CardScript = {
  oracleId: FOUNDRY_CHAMPION.oracleId,
  name: FOUNDRY_CHAMPION.name,
  activated: [
    {
      ref: `${FOUNDRY_CHAMPION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
    {
      ref: `${FOUNDRY_CHAMPION.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 1 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Foundry Champion - ~ deals damage to any target equal to the number of creatures you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
