import test from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { migrate } from '../src/migrate.js';
import { MemoryStore, PostgresStore } from '../src/store.js';

async function database() {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  await migrate(pool, { useAdvisoryLock: false });
  return pool;
}

test('versioned migrations create the complete persistence foundation', async () => {
  const pool = await database();
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const names = new Set(tables.rows.map((row) => row.table_name));
  for (const name of ['schema_migrations', 'users', 'sessions', 'pairing_invites',
    'support_relationships', 'check_ins', 'support_plans', 'follow_ups',
    'consent_events', 'audit_events']) assert.ok(names.has(name), name);
  const auditColumns = await pool.query(
    `SELECT column_name,is_nullable FROM information_schema.columns
     WHERE table_name='audit_events' AND column_name IN ('subject_type','subject_id')`
  );
  assert.deepEqual(
    auditColumns.rows.map((row) => [row.column_name, row.is_nullable]).sort(),
    [['subject_id', 'NO'], ['subject_type', 'NO']]
  );
});

test('real PostgreSQL migration path locks before bootstrap DDL and unlocks afterward', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.startsWith('SELECT version FROM schema_migrations')) return { rowCount: 1, rows: [{ version: 'applied' }] };
      return { rowCount: 0, rows: [] };
    },
    release() {}
  };
  await migrate({ connect: async () => client });
  assert.match(queries[0], /pg_advisory_lock/);
  assert.ok(queries.findIndex((sql) => /pg_advisory_lock/.test(sql)) < queries.findIndex((sql) => /CREATE TABLE IF NOT EXISTS schema_migrations/.test(sql)));
  assert.match(queries.at(-1), /pg_advisory_unlock/);
});

test('a second store against the same database sees committed records', async () => {
  const pool = await database();
  const first = new PostgresStore(pool, { pairingSecret: 'test-pairing-secret' });
  const participant = await first.createUser({ role: 'participant', displayName: 'Pat' });
  await first.createCheckIn(participant.id, { energy: 'low' }, { level: 'check-in' });
  const second = new PostgresStore(pool, { pairingSecret: 'test-pairing-secret' });
  const records = await second.listCheckIns(participant.id);
  assert.equal(records.length, 1);
  assert.equal(records[0].input.energy, 'low');
});

test('sessions and pairing secrets are stored only as hashes', async () => {
  const pool = await database();
  const store = new PostgresStore(pool, { pairingSecret: 'test-pairing-secret' });
  const user = await store.createUser({ role: 'participant', displayName: 'Pat' });
  await store.createSession(user.id, 'plain-session-token', new Date(Date.now() + 60_000));
  await store.createInvite(user.id, 'ABCD2345', new Date(Date.now() + 60_000));
  const session = await pool.query('SELECT token_hash FROM sessions');
  const invite = await pool.query('SELECT code_hash FROM pairing_invites');
  assert.notEqual(session.rows[0].token_hash, 'plain-session-token');
  assert.notEqual(invite.rows[0].code_hash, 'ABCD2345');
});

test('session deletion and follow-up writes retain required audit subjects', async () => {
  const pool = await database();
  const store = new PostgresStore(pool, { pairingSecret: 'test-pairing-secret' });
  const participant = await store.createUser({ role: 'participant', displayName: 'Pat' });
  const supporter = await store.createUser({ role: 'supporter', displayName: 'Sam' });
  const now = new Date('2026-07-26T10:00:00Z');

  await store.createSession(participant.id, 'session-to-delete', new Date(now.getTime() + 60_000));
  const storedSession = await pool.query('SELECT id FROM sessions WHERE user_id=$1', [participant.id]);
  await store.deleteSession('session-to-delete');

  await store.createInvite(participant.id, 'AUDIT001', new Date(now.getTime() + 60_000));
  const relationship = await store.claimInvite('AUDIT001', supporter.id, now);
  await store.changeRelationship(relationship.id, participant, 'confirm', now);
  const followUp = await store.recordFollowUp(relationship.id, supporter, 'contacted');

  const audit = await pool.query(
    `SELECT event_type,subject_type,subject_id FROM audit_events
     WHERE event_type IN ('session.deleted','followup.created') ORDER BY event_type`
  );
  assert.deepEqual(audit.rows, [
    { event_type: 'followup.created', subject_type: 'follow_up', subject_id: followUp.id },
    { event_type: 'session.deleted', subject_type: 'session', subject_id: storedSession.rows[0].id }
  ]);
});

test('PostgreSQL pairing lifecycle is transactional, auditable, and reconnectable', async () => {
  const pool = await database();
  const store = new PostgresStore(pool, { pairingSecret: 'test-pairing-secret' });
  const participant = await store.createUser({ role: 'participant', displayName: 'Pat' });
  const supporter = await store.createUser({ role: 'supporter', displayName: 'Sam' });
  const now = new Date('2026-07-26T10:00:00Z');

  await store.createInvite(participant.id, 'PAIR0001', new Date(now.getTime() + 60_000));
  const relationship = await store.claimInvite('PAIR0001', supporter.id, now);
  assert.equal(relationship.status, 'pending_confirmation');
  assert.equal((await store.changeRelationship(relationship.id, participant, 'confirm', now)).status, 'active');
  assert.equal((await store.changeRelationship(relationship.id, supporter, 'revoke', now)).status, 'revoked');
  assert.equal(await store.changeRelationship(relationship.id, participant, 'confirm', now), null);

  await store.createInvite(participant.id, 'PAIR0002', new Date(now.getTime() + 60_000));
  const reconnected = await store.claimInvite('PAIR0002', supporter.id, now);
  assert.equal(reconnected.id, relationship.id);
  assert.equal(reconnected.status, 'pending_confirmation');

  const events = await pool.query('SELECT event_type FROM consent_events WHERE relationship_id=$1 ORDER BY created_at', [relationship.id]);
  assert.deepEqual(events.rows.map((row) => row.event_type), [
    'supporter_claimed', 'participant_confirmed', 'relationship_revoked', 'supporter_claimed'
  ]);
  const audit = await pool.query("SELECT event_type FROM audit_events WHERE event_type LIKE 'pairing.%'");
  assert.deepEqual(audit.rows.map((row) => row.event_type).sort(), [
    'pairing.claimed', 'pairing.claimed', 'pairing.confirmed', 'pairing.invite_created', 'pairing.invite_created', 'pairing.revoked'
  ]);
});

test('check-in lists are newest-first and bounded for participant and shared views', async () => {
  let tick = 0;
  const store = new MemoryStore({ now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)) });
  const participant = await store.createUser({ role: 'participant', displayName: 'Pat' });
  const supporter = await store.createUser({ role: 'supporter', displayName: 'Sam' });
  const relationship = { id: 'relationship-1', participantId: participant.id, supporterId: supporter.id, status: 'active', scopes: ['checkin_summary'] };
  store.relationships.push(relationship);
  for (let index = 0; index < 102; index += 1) await store.createCheckIn(participant.id, { index }, { index });

  const own = await store.listCheckIns(participant.id);
  assert.equal(own.length, 100);
  assert.deepEqual(own.map((record) => record.input.index), Array.from({ length: 100 }, (_, index) => 101 - index));
  const shared = await store.listSharedCheckIns(relationship.id, supporter);
  assert.equal(shared.length, 30);
  assert.deepEqual(shared.map((record) => record.summary.index), Array.from({ length: 30 }, (_, index) => 101 - index));

  const pool = await database();
  let postgresTick = 0;
  const postgres = new PostgresStore(pool, {
    pairingSecret: 'test-pairing-secret',
    now: () => new Date(Date.UTC(2026, 0, 2, 0, 0, postgresTick++))
  });
  const postgresParticipant = await postgres.createUser({ role: 'participant', displayName: 'Postgres Pat' });
  for (let index = 0; index < 102; index += 1) await postgres.createCheckIn(postgresParticipant.id, { index }, { index });
  const postgresOwn = await postgres.listCheckIns(postgresParticipant.id);
  assert.equal(postgresOwn.length, 100);
  assert.deepEqual(postgresOwn.map((record) => record.input.index), Array.from({ length: 100 }, (_, index) => 101 - index));
});
