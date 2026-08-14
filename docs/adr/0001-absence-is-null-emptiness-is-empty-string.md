# Absence is `null`, emptiness is `''`, and nothing is optional

Domain types express missing data one way per kind: free-text fields are
`string` and an unset one is `''`; everything else that can be genuinely absent
is `| null`. No domain property is ever declared optional with `?:`.

The mixed look is deliberate, not drift left over from the prototype. "No
nickname" and "empty nickname" are not two states, so allowing both `''` and
`null` for `aka` would give one fact two representations — the failure mode the
whole model exists to avoid. `propCount` is different: absent and zero are
genuinely different claims, so it takes `null`. Optional properties are
rejected outright because they are a third, weaker claim ("the key may not be
there") that survives a `localStorage` round-trip badly and makes exhaustive
mapping unverifiable.

## Consequences

Every domain type has exactly the same key set as its database row, always
present. Both directions of `data/mappers.ts` stay total field copies with no
conditional key construction — which is what makes it cheap to see, by reading
the mapper alone, that no column was forgotten.
