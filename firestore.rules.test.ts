import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-project-test',
    firestore: { rules: readFileSync('DRAFT_firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
});

describe('Firestore security rules', () => {
  it('allows user to create their own profile', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    const docRef = db.collection('users').doc('alice');
    await assertSucceeds(docRef.set({
      user: {
        id: 'alice',
        username: 'alice_user',
        email: 'alice@example.com',
        joinedDate: '2023-01-01T00:00:00Z',
      }
    }));
  });

  it('denies user creating someone else\'s profile', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    const docRef = db.collection('users').doc('bob');
    await assertFails(docRef.set({
      user: {
        id: 'bob',
        username: 'bob_user',
        email: 'bob@example.com',
        joinedDate: '2023-01-01T00:00:00Z',
      }
    }));
  });

  it('denies user injecting a ghost field on update', async () => {
    // Setup
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc('alice').set({
            user: {
              id: 'alice',
              username: 'alice_user',
              email: 'alice@example.com',
              joinedDate: '2023-01-01T00:00:00Z',
            }
        });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    const docRef = db.collection('users').doc('alice');
        
    await assertFails(docRef.update({
        'user.isVerified': true
    }));
  });

  it('denies update of immutable fields', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc('alice').set({
            user: {
              id: 'alice',
              username: 'alice_user',
              email: 'alice@example.com',
              joinedDate: '2023-01-01T00:00:00Z',
            }
        });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    const docRef = db.collection('users').doc('alice');
        
    await assertFails(docRef.update({
        'user.email': 'hacker@example.com'
    }));
  });
  
  it('allows safe updates', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc('alice').set({
            user: {
              id: 'alice',
              username: 'alice_user',
              email: 'alice@example.com',
              joinedDate: '2023-01-01T00:00:00Z',
            }
        });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    const docRef = db.collection('users').doc('alice');
        
    await assertSucceeds(docRef.update({
        'user.displayName': 'Alice the Great',
        'user.loginAttempts': 1
    }));
  })
});
