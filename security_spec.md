# Security Specification

## Data Invariants
1. A User document can only be created by the owner (UID must match document ID).
2. A User document can only be updated by the owner.
3. User document must have a `user` field as it's nested structure.
4. User cannot inject unknown fields or excessive payload sizes.

## The "Dirty Dozen" Payloads
1. **Creation Spoofing:** Create a `users/{userId}` where `userId` belongs to another person.
2. **Read Spoofing:** Read a `users/{userId}` where `userId` is a different user.
3. **Payload Injection:** Inject a 1MB string into the `displayName`.
4. **Role Escalation:** Try to modify a non-existent role, or passkey.
5. **Timestamp Attack:** Provide a future timestamp.
6. **Key Injection:** Add `isAdmin: true` inside the user profile.
7. **Type Mismatch:** Set `loginAttempts` to a string instead of a number.
8. **Size Limits:** Exceed the max size of `avatarUrl`.
9. **Missing Required Fields:** Update user without a required field.
10. **Schema Invalidation:** Send `lockUntil` as a string instead of a number/null.
11. **Shadow Update Test:** Add an unknown field `isVerified` to the user profile update.
12. **Null User Field:** Attempt to update the user without the nested `user` container.
