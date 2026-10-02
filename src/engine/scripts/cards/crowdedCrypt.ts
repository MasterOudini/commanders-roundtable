// `Crowded Crypt` - a creatureYouControlDies trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CROWDED_CRYPT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CROWDED_CRYPT, "{T}: Add {B}.\nWhenever a creature you control dies, put a corpse counter on this artifact.\n{4}{B}{B}, {T}, Sacrifice this artifact: Create a 2/2 black Zombie creature token with decayed for each corpse counter on this artifact. (A creature with decayed can't block. When it attacks, sacrifice it at end of combat.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a corpse counter on this artifact.", CROWDED_CRYPT.name);
const VOCAB_T_L1 = vocabularyTargets("Put a corpse counter on this artifact.");
const VOCAB_A1 = vocabularyEffects("Create a 2/2 black Zombie creature token with decayed for each corpse counter on ~.", CROWDED_CRYPT.name);
const VOCAB_T_A1 = vocabularyTargets("Create a 2/2 black Zombie creature token with decayed for each corpse counter on ~.");

export const CROWDED_CRYPT_SCRIPT: CardScript = {
  oracleId: CROWDED_CRYPT.oracleId,
  name: CROWDED_CRYPT.name,
  activated: [
    {
      ref: `${CROWDED_CRYPT.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'creatureYouControlDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Crowded Crypt - Put a corpse counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
