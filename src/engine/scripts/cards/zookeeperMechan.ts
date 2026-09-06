// `Zookeeper Mechan` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZOOKEEPER_MECHAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZOOKEEPER_MECHAN, "{T}: Add {R}.\n{6}{R}: Target creature you control gets +4/+0 until end of turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target creature you control gets +4/+0 until end of turn.", ZOOKEEPER_MECHAN.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature you control gets +4/+0 until end of turn.");

export const ZOOKEEPER_MECHAN_SCRIPT: CardScript = {
  oracleId: ZOOKEEPER_MECHAN.oracleId,
  name: ZOOKEEPER_MECHAN.name,
  activated: [
    {
      ref: `${ZOOKEEPER_MECHAN.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
