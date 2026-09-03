// `Priest of the Blood Rite` - enters: a 5/5 black Demon token with flying (the
// TOKEN_TABLE's, D133); each of its controller's upkeeps: lose 2 life. Whole after
// D295's "you lose N life" sentence reading.

import { PRIEST_OF_THE_BLOOD_RITE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(
  PRIEST_OF_THE_BLOOD_RITE,
  'When this creature enters, create a 5/5 black Demon creature token with flying.\nAt the beginning of your upkeep, you lose 2 life.',
);
const ENTERS_TEXT = PRINTED.split('\n')[0] as string;
const UPKEEP_TEXT = PRINTED.split('\n')[1] as string;
const DEMON = tokenRef('Demon|5/5|B|Creature|flying');

export const PRIEST_OF_THE_BLOOD_RITE_SCRIPT: CardScript = {
  oracleId: PRIEST_OF_THE_BLOOD_RITE.oracleId,
  name: PRIEST_OF_THE_BLOOD_RITE.name,
  triggers: [
    {
      abilityId: 'etb',
      text: ENTERS_TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'Priest of the Blood Rite - create a 5/5 Demon with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: DEMON.oracleId,
          printingId: DEMON.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
    {
      abilityId: 'upkeep',
      text: UPKEEP_TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Priest of the Blood Rite - lose 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -2, to: me.life - 2 }];
      },
    },
  ],
};
