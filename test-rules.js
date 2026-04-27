import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function runTests() {
  const projectId = `test-project-${Date.now()}`;
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
    },
  });

  const aliceId = 'alice123';
  const alice = testEnv.authenticatedContext(aliceId, { email: 'alice@example.com' });

  // Setup initial data
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.collection('users').doc(aliceId).set({
      user: {
        id: aliceId,
        username: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        joinedDate: '2026-04-03T17:01:25.123Z',
        loginAttempts: 0,
        lockUntil: null
      }
    });
  });

  const db = alice.firestore();
  
  try {
    await assertSucceeds(db.collection('users').doc(aliceId).update({
      user: {
        id: aliceId,
        username: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        joinedDate: '2026-04-03T17:01:25.123Z',
        loginAttempts: 0,
        lockUntil: null,
        pro_status: true
      }
    }));
    console.log("Update succeeded!");
  } catch (e) {
    console.error("Update failed:", e);
  }

  await testEnv.cleanup();
}

runTests().catch(console.error);
