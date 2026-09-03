// The combat-role target qualifier (D291): "target attacking creature" is a
// structured restriction the parser reads and the validator enforces against
// the live combat — no longer a word listed as unenforced.

import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from '../data/targetParse';
import { parseEffects } from '../data/effectParse';

describe('the combat-role qualifier is READ (D291)', () => {
  test('"attacking creature" is a structured restriction with nothing unenforced', () => {
    const [spec] = parseTargetClauses('Destroy target attacking creature.');
    expect(spec?.kinds).toEqual(['creature']);
    expect(spec?.combatRole).toBe('attacking');
    expect(spec?.unenforced).toEqual([]);
    expect(spec?.text).toBe('target attacking creature');
  });

  test('"blocking" and "attacking or blocking" read their own roles', () => {
    expect(parseTargetClauses('Destroy target blocking creature.')[0]?.combatRole).toBe('blocking');
    expect(parseTargetClauses('Destroy target attacking or blocking creature.')[0]?.combatRole).toBe('attackingOrBlocking');
  });

  test('a role and a keyword compose', () => {
    const [spec] = parseTargetClauses('Target attacking creature without flying gains flying until end of turn.');
    expect(spec?.combatRole).toBe('attacking');
    expect(spec?.keyword).toEqual({ word: 'flying', present: false });
    // The clause opens the sentence, so the printed span keeps its capital.
    expect(spec?.text).toBe('Target attacking creature without flying');
  });

  test('a plain creature clause names no role', () => {
    expect(parseTargetClauses('Destroy target creature.')[0]?.combatRole).toBeNull();
  });

  test('effectParse already admitted the phrase; the sentence is auto now that the role is enforced', () => {
    expect(parseEffects('Destroy target attacking creature.', 'x', true).mode).toBe('auto');
  });
});
