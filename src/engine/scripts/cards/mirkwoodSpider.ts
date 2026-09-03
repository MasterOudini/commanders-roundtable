// `Mirkwood Spider` - pump on "target legendary creature you control gains deathtouch until end of turn": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { MIRKWOOD_SPIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIRKWOOD_SPIDER, "Deathtouch\nWhenever this creature attacks, target legendary creature you control gains deathtouch until end of turn.");
const TEXT = PRINTED.split('\n')[1] as string;

export const MIRKWOOD_SPIDER_SCRIPT: CardScript = {
  oracleId: MIRKWOOD_SPIDER.oracleId,
  name: MIRKWOOD_SPIDER.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Mirkwood Spider - target legendary creature you control gains deathtouch until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
  ],
};
