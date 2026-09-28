import { describe, expect, it } from 'vitest';

describe('DOW-1269 PR gate rehearsal', () => {
  it('proves CI observes changes from the ticket worktree', () => {
    expect('green').toBe('green');
  });
});
