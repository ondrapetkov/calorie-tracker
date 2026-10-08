import { describe, expect, it } from 'vitest'
import { matchesQuery, rankScore, wordMatches } from './search'

describe('wordMatches', () => {
  it('matches prefixes and ignores short unrelated words', () => {
    expect(wordMatches('pap', 'paprika')).toBe(true)
    expect(wordMatches('tvaroh', 'tvaroh')).toBe(true)
    expect(wordMatches('ab', 'abc')).toBe(true)
    expect(wordMatches('mrk', 'mleko')).toBe(false)
  })

  it('tolerates Czech word endings', () => {
    expect(wordMatches('prsa', 'prsou')).toBe(true)
    expect(wordMatches('paprika', 'papriky')).toBe(true)
    expect(wordMatches('kureci', 'kurecich')).toBe(true)
  })

  it('does not match different words that merely start alike', () => {
    expect(wordMatches('mleko', 'mlyn')).toBe(false)
    expect(wordMatches('rice', 'rizek')).toBe(false)
  })
})

describe('matchesQuery', () => {
  it('requires every query word and ignores diacritics and case', () => {
    expect(matchesQuery('Kuřecí prsa bez kůže, syrová', 'kuřecí prsa')).toBe(true)
    expect(matchesQuery('Kuřecí prsa bez kůže, syrová', 'KURECI PRSA')).toBe(true)
    expect(matchesQuery('Kuřecí prsa bez kůže, syrová', 'kureci stehno')).toBe(false)
    expect(matchesQuery('Paprika červená, syrová', 'paprika cervena')).toBe(true)
  })

  it('returns false for an empty query', () => {
    expect(matchesQuery('anything', '   ')).toBe(false)
  })
})

describe('rankScore', () => {
  it('ranks names that start with the query first, then shorter names', () => {
    expect(rankScore('Paprika červená', 'paprika')).toBeLessThan(rankScore('Zelená paprika', 'paprika'))
    expect(rankScore('Mrkev', 'mr')).toBeLessThan(rankScore('Mrkev vařená s máslem', 'mr'))
  })
})
