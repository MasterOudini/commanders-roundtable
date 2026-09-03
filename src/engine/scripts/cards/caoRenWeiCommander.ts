// `Cao Ren, Wei Commander` - selfLife on "you lose 3 life": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { CAO_REN_WEI_COMMANDER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(CAO_REN_WEI_COMMANDER, "Horsemanship (This creature can't be blocked except by creatures with horsemanship.)\nWhen Cao Ren enters, you lose 3 life.");
const TEXT = PRINTED.split('\n')[1] as string;

export const CAO_REN_WEI_COMMANDER_SCRIPT: CardScript = {
  oracleId: CAO_REN_WEI_COMMANDER.oracleId,
  name: CAO_REN_WEI_COMMANDER.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => "Cao Ren, Wei Commander - you lose 3 life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -3, to: me.life + (-3) }];
      },
    },
  ],
};
