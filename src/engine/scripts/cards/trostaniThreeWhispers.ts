// `Trostani, Three Whispers` — three keyword grants until cleanup, each for
// its own mana and with no tap: deathtouch, vigilance, double strike.

import { TROSTANI_THREE_WHISPERS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { ActivatedDef, CardScript } from '../api';
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

const PRINTED = printed(
  TROSTANI_THREE_WHISPERS,
  '{1}{G}: Target creature gains deathtouch until end of turn.\n{G/W}: Target creature gains vigilance until end of turn.\n{2}{W}: Target creature gains double strike until end of turn.',
);
const LINES = PRINTED.split('\n');

type Granted = NonNullable<Extract<EventBody, { t: 'PtModifiedUntilEndOfTurn' }>['keywords']>[number];

function grant(keyword: Granted): ActivatedDef['resolve'] {
  return (ctx, _self, obj): readonly EventBody[] => {
    const target = obj.targets[0];
    if (!target || target.kind !== 'card') return [];
    if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
    return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: [keyword] }];
  };
}

export const TROSTANI_THREE_WHISPERS_SCRIPT: CardScript = {
  oracleId: TROSTANI_THREE_WHISPERS.oracleId,
  name: TROSTANI_THREE_WHISPERS.name,
  activated: [
    { ref: `${TROSTANI_THREE_WHISPERS.oracleId}#a0`, text: LINES[0] as string, resolve: grant('deathtouch') },
    { ref: `${TROSTANI_THREE_WHISPERS.oracleId}#a1`, text: LINES[1] as string, resolve: grant('vigilance') },
    { ref: `${TROSTANI_THREE_WHISPERS.oracleId}#a2`, text: LINES[2] as string, resolve: grant('doubleStrike') },
  ],
};
