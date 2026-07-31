import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';

export const hashSecret = (value) => createHash('sha256').update(value).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
const hashInviteCode = (value, secret) => createHmac('sha256', secret).update(value).digest('hex');

export class PostgresStore {
  constructor(pool, { pairingSecret, now = () => new Date() } = {}) {
    if (!pairingSecret) throw new Error('PAIRING_SECRET is required for PostgreSQL pairing');
    this.pool = pool;
    this.pairingSecret = pairingSecret;
    this.now = now;
  }
  async createUser({ role, displayName }) {
    const id = randomUUID();
    const result = await this.pool.query('INSERT INTO users(id,role,display_name) VALUES($1,$2,$3) RETURNING id,role,display_name AS "displayName"', [id, role, displayName]);
    return result.rows[0];
  }
  async createSession(userId, token, expiresAt) {
    const sessionId = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)', [sessionId, userId, hashSecret(token), expiresAt]);
      await client.query('INSERT INTO audit_events(id,actor_id,event_type,subject_type,subject_id,details_json) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), userId, 'session.created', 'session', sessionId, {}]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async getSession(token, now = new Date()) {
    const result = await this.pool.query(`SELECT u.id,u.role,u.display_name AS "displayName" FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2`, [hashSecret(token), now]);
    return result.rows[0] || null;
  }
  async deleteSession(token) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const deleted = await client.query('DELETE FROM sessions WHERE token_hash=$1 RETURNING id,user_id', [hashSecret(token)]);
      if (deleted.rows[0]) await client.query('INSERT INTO audit_events(id,actor_id,event_type,subject_type,subject_id,details_json) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), deleted.rows[0].user_id, 'session.deleted', 'session', deleted.rows[0].id, {}]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async createInvite(participantId, code, expiresAt) {
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO pairing_invites(id,participant_id,code_hash,expires_at) VALUES($1,$2,$3,$4)', [id, participantId, hashInviteCode(code, this.pairingSecret), expiresAt]);
      await client.query('INSERT INTO audit_events(id,actor_id,event_type,subject_type,subject_id,details_json) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), participantId, 'pairing.invite_created', 'pairing_invite', id, { expiresAt }]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return { id, participantId, expiresAt };
  }
  async createCheckIn(participantId, input, result) {
    const id = randomUUID();
    const createdAt = this.now();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO check_ins(id,participant_id,input_json,result_json,created_at) VALUES($1,$2,$3,$4,$5)', [id, participantId, input, result, createdAt]);
      await client.query('INSERT INTO audit_events(id,actor_id,event_type,subject_type,subject_id,details_json) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), participantId, 'checkin.created', 'check_in', id, {}]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return { id, createdAt };
  }
  async listCheckIns(participantId) {
    const result = await this.pool.query('SELECT id,input_json AS input,result_json AS result,created_at AS "createdAt" FROM check_ins WHERE participant_id=$1 ORDER BY created_at DESC LIMIT 100', [participantId]);
    return result.rows;
  }
  // Only resolves while the relationship is active and the participant confirmed it, so a
  // supporter can never reach records through a revoked or pending connection.
  async participantIdForRelationship(relationshipId, user) {
    const result = await this.pool.query(
      `SELECT participant_id AS "participantId" FROM support_relationships
       WHERE id=$1 AND supporter_id=$2 AND status='active'`,
      [relationshipId, user.id]
    );
    return result.rows[0]?.participantId || null;
  }
  async createVitalRecord(participantId, record) {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO vital_records(id,participant_id,measured_at,systolic,diastolic,pulse,posture,glucose,glucose_context,water_ml,note)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, participantId, record.measuredAt, record.systolic, record.diastolic, record.pulse,
        record.posture, record.glucose, record.glucoseContext, record.waterMl, record.note]
    );
    return { id, ...record };
  }
  async listVitalRecords(participantId, limit = 90) {
    const result = await this.pool.query(
      `SELECT id, measured_at AS "measuredAt", systolic, diastolic, pulse, posture,
              glucose, glucose_context AS "glucoseContext", water_ml AS "waterMl", note
       FROM vital_records WHERE participant_id=$1 ORDER BY measured_at DESC LIMIT $2`,
      [participantId, limit]
    );
    return result.rows;
  }
  async createMedicationPlan(participantId, plan) {
    const id = randomUUID();
    await this.pool.query(
      'INSERT INTO medication_plans(id,participant_id,name,times_per_day,instructions) VALUES($1,$2,$3,$4,$5)',
      [id, participantId, plan.name, plan.timesPerDay, plan.instructions]
    );
    return { id, active: true, ...plan };
  }
  async listMedicationPlans(participantId) {
    const result = await this.pool.query(
      `SELECT id, name, times_per_day AS "timesPerDay", instructions, active
       FROM medication_plans WHERE participant_id=$1 AND active ORDER BY created_at`,
      [participantId]
    );
    return result.rows;
  }
  async deactivateMedicationPlan(participantId, planId) {
    const result = await this.pool.query(
      'UPDATE medication_plans SET active=false WHERE id=$1 AND participant_id=$2 AND active RETURNING id',
      [planId, participantId]
    );
    return result.rowCount > 0;
  }
  async createMedicationRecord(participantId, record) {
    const id = randomUUID();
    await this.pool.query(
      'INSERT INTO medication_records(id,participant_id,taken_at,name,note) VALUES($1,$2,$3,$4,$5)',
      [id, participantId, record.takenAt, record.name, record.note]
    );
    return { id, ...record };
  }
  async listMedicationRecords(participantId, limit = 90) {
    const result = await this.pool.query(
      `SELECT id, taken_at AS "takenAt", name, note
       FROM medication_records WHERE participant_id=$1 ORDER BY taken_at DESC LIMIT $2`,
      [participantId, limit]
    );
    return result.rows;
  }
  async createMealRecord(participantId, record) {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO meal_records(id,participant_id,eaten_at,meal_slot,description,kcal,carb_g,protein_g,fat_g)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, participantId, record.eatenAt, record.mealSlot, record.description,
        record.kcal, record.carbG, record.proteinG, record.fatG]
    );
    return { id, ...record };
  }
  async listMealRecords(participantId, limit = 90) {
    const result = await this.pool.query(
      `SELECT id, eaten_at AS "eatenAt", meal_slot AS "mealSlot", description,
              kcal, carb_g AS "carbG", protein_g AS "proteinG", fat_g AS "fatG"
       FROM meal_records WHERE participant_id=$1 ORDER BY eaten_at DESC LIMIT $2`,
      [participantId, limit]
    );
    return result.rows;
  }
  async claimInvite(code, supporterId, now) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM pairing_invites WHERE code_hash=$1 FOR UPDATE', [hashInviteCode(code, this.pairingSecret)]);
      const invite = found.rows[0];
      const invalid = !invite ? 'not_found' : new Date(invite.expires_at) <= now ? 'expired' : invite.claimed_by ? 'claimed' : null;
      if (invalid) {
        await client.query('ROLLBACK');
        return { error: invalid };
      }
      const existing = await client.query(
        'SELECT id,status FROM support_relationships WHERE participant_id=$1 AND supporter_id=$2 FOR UPDATE',
        [invite.participant_id, supporterId]
      );
      if (existing.rows[0]?.status === 'active') {
        await client.query('ROLLBACK');
        return { error: 'already_connected' };
      }
      const id = existing.rows[0]?.id || randomUUID();
      await client.query('UPDATE pairing_invites SET claimed_by=$1,claimed_at=$2 WHERE id=$3', [supporterId, now, invite.id]);
      await client.query(
        `INSERT INTO support_relationships(id,participant_id,supporter_id,status)
         VALUES($1,$2,$3,'pending_confirmation')
         ON CONFLICT(participant_id,supporter_id) DO UPDATE
         SET status='pending_confirmation',scopes_json='[]',confirmed_at=NULL,revoked_at=NULL,created_at=CURRENT_TIMESTAMP`,
        [id, invite.participant_id, supporterId]
      );
      await client.query(
        `INSERT INTO consent_events(id,relationship_id,actor_id,event_type,details_json)
         VALUES($1,$2,$3,'supporter_claimed',$4)`,
        [randomUUID(), id, supporterId, { inviteId: invite.id }]
      );
      await client.query('INSERT INTO audit_events(id,actor_id,event_type,subject_type,subject_id,details_json) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), supporterId, 'pairing.claimed', 'support_relationship', id, { inviteId: invite.id }]);
      await client.query('COMMIT');
      return { id, participantId: invite.participant_id, supporterId, status: 'pending_confirmation' };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async listRelationships(user) {
    const column = user.role === 'participant' ? 'participant_id' : 'supporter_id';
    const result = await this.pool.query(
      `SELECT r.id,r.participant_id AS "participantId",r.supporter_id AS "supporterId",r.status,r.scopes_json AS scopes,
              CASE WHEN $2='participant' THEN supporter.display_name ELSE participant.display_name END AS "otherPartyName"
       FROM support_relationships r
       JOIN users participant ON participant.id=r.participant_id
       JOIN users supporter ON supporter.id=r.supporter_id
       WHERE r.${column}=$1
       ORDER BY r.created_at DESC`,
      [user.id, user.role]
    );
    return result.rows;
  }
  async changeRelationship(id, user, action, now) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = action === 'confirm'
        ? await client.query(
          `UPDATE support_relationships SET status='active',scopes_json=$4,confirmed_at=$1
           WHERE id=$2 AND participant_id=$3 AND status='pending_confirmation'
           RETURNING id,participant_id AS "participantId",supporter_id AS "supporterId",status,scopes_json AS scopes`,
          [now, id, user.id, JSON.stringify(['checkin_summary'])]
        )
        : await client.query(
          `UPDATE support_relationships SET status='revoked',revoked_at=$1
           WHERE id=$2 AND (participant_id=$3 OR supporter_id=$3) AND status IN ('pending_confirmation','active')
           RETURNING id,participant_id AS "participantId",supporter_id AS "supporterId",status`,
          [now, id, user.id]
        );
      const relationship = result.rows[0];
      if (!relationship || (action === 'confirm' && user.role !== 'participant')) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(
        `INSERT INTO consent_events(id,relationship_id,actor_id,event_type,details_json)
         VALUES($1,$2,$3,$4,$5)`,
        [randomUUID(), id, user.id, action === 'confirm' ? 'participant_confirmed' : 'relationship_revoked', action === 'confirm' ? { scopes: ['checkin_summary'] } : {}]
      );
      await client.query('INSERT INTO audit_events(id,actor_id,event_type,subject_type,subject_id,details_json) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), user.id, action === 'confirm' ? 'pairing.confirmed' : 'pairing.revoked', 'support_relationship', id, {}]);
      await client.query('COMMIT');
      return relationship;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async recordFollowUp(relationshipId, user, action) {
    if (user.role !== 'supporter') return null;
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO follow_ups(id,relationship_id,actor_id,action)
         SELECT $1,id,$2,$3 FROM support_relationships
         WHERE id=$4 AND supporter_id=$2 AND status='active' RETURNING id`,
        [id, user.id, action, relationshipId]
      );
      if (!inserted.rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('INSERT INTO audit_events(id,actor_id,event_type,subject_type,subject_id,details_json) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), user.id, 'followup.created', 'follow_up', id, { relationshipId, action }]);
      await client.query('COMMIT');
      return { id, relationshipId, action };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async listSharedCheckIns(relationshipId, user) {
    if (user.role !== 'supporter') return null;
    const relationship = await this.pool.query(
      `SELECT participant_id,scopes_json FROM support_relationships
       WHERE id=$1 AND supporter_id=$2 AND status='active'`,
      [relationshipId, user.id]
    );
    const allowed = relationship.rows[0];
    if (!allowed || !allowed.scopes_json.includes('checkin_summary')) return null;
    const result = await this.pool.query(
      `SELECT id,result_json AS summary,created_at AS "createdAt"
       FROM check_ins WHERE participant_id=$1 ORDER BY created_at DESC LIMIT 30`,
      [allowed.participant_id]
    );
    return result.rows;
  }
}

export class MemoryStore {
  constructor({ now = () => new Date(), pairingSecret = 'memory-store-only' } = {}) {
    this.now = now; this.pairingSecret = pairingSecret; this.users = []; this.sessions = []; this.invites = []; this.relationships = []; this.checkIns = []; this.followUps = []; this.consentEvents = []; this.auditEvents = []; this.vitalRecords = []; this.mealRecords = []; this.medicationRecords = []; this.medicationPlans = [];
  }
  async createUser({ role, displayName }) { const user = { id: randomUUID(), role, displayName }; this.users.push(user); return user; }
  async createSession(userId, token, expiresAt) { this.sessions.push({ userId, tokenHash: hashSecret(token), expiresAt }); this.auditEvents.push({ actorId: userId, eventType: 'session.created' }); }
  async getSession(token, now = this.now()) { const s = this.sessions.find((x) => x.tokenHash === hashSecret(token) && x.expiresAt > now); return s ? this.users.find((u) => u.id === s.userId) : null; }
  async deleteSession(token) { const found = this.sessions.find((x) => x.tokenHash === hashSecret(token)); this.sessions = this.sessions.filter((x) => x !== found); if (found) this.auditEvents.push({ actorId: found.userId, eventType: 'session.deleted' }); }
  async createInvite(participantId, code, expiresAt) { const value = { id: randomUUID(), participantId, codeHash: hashInviteCode(code, this.pairingSecret), expiresAt }; this.invites.push(value); this.auditEvents.push({ actorId: participantId, eventType: 'pairing.invite_created' }); return value; }
  async claimInvite(code, supporterId, now) {
    const invite = this.invites.find((x) => x.codeHash === hashInviteCode(code, this.pairingSecret));
    if (!invite) return { error: 'not_found' };
    if (invite.expiresAt <= now) return { error: 'expired' };
    if (invite.claimedBy) return { error: 'claimed' };
    const existing = this.relationships.find((x) => x.participantId === invite.participantId && x.supporterId === supporterId);
    if (existing?.status === 'active') return { error: 'already_connected' };
    invite.claimedBy = supporterId;
    const value = existing || { id: randomUUID(), participantId: invite.participantId, supporterId };
    value.status = 'pending_confirmation'; value.scopes = [];
    if (!existing) this.relationships.push(value);
    this.consentEvents.push({ relationshipId: value.id, actorId: supporterId, eventType: 'supporter_claimed' });
    this.auditEvents.push({ actorId: supporterId, eventType: 'pairing.claimed' });
    return value;
  }
  async listRelationships(user) {
    return this.relationships
      .filter((r) => user.role === 'participant' ? r.participantId === user.id : r.supporterId === user.id)
      .map((r) => ({
        ...r,
        otherPartyName: this.users.find((candidate) => candidate.id === (user.role === 'participant' ? r.supporterId : r.participantId))?.displayName || 'Unknown'
      }));
  }
  async changeRelationship(id, user, action) {
    const r = this.relationships.find((x) => x.id === id && (x.participantId === user.id || x.supporterId === user.id));
    if (!r || !['pending_confirmation', 'active'].includes(r.status)) return null;
    if (action === 'confirm' && (user.role !== 'participant' || r.participantId !== user.id || r.status !== 'pending_confirmation')) return null;
    r.status = action === 'confirm' ? 'active' : 'revoked';
    if (action === 'confirm') r.scopes = ['checkin_summary'];
    this.consentEvents.push({ relationshipId: r.id, actorId: user.id, eventType: action === 'confirm' ? 'participant_confirmed' : 'relationship_revoked' });
    this.auditEvents.push({ actorId: user.id, eventType: action === 'confirm' ? 'pairing.confirmed' : 'pairing.revoked' });
    return r;
  }
  async createCheckIn(participantId, input, result) { const value = { id: randomUUID(), participantId, input, result, createdAt: this.now() }; this.checkIns.push(value); this.auditEvents.push({ actorId: participantId, eventType: 'checkin.created' }); return value; }
  async listCheckIns(participantId) {
    return this.checkIns.filter((x) => x.participantId === participantId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
  }
  async participantIdForRelationship(relationshipId, user) {
    const relationship = this.relationships.find(
      (r) => r.id === relationshipId && r.supporterId === user.id && r.status === 'active'
    );
    return relationship?.participantId || null;
  }
  async createVitalRecord(participantId, record) {
    const value = { id: randomUUID(), participantId, ...record };
    this.vitalRecords.push(value);
    this.auditEvents.push({ actorId: participantId, eventType: 'vital.created' });
    return value;
  }
  async listVitalRecords(participantId, limit = 90) {
    return this.vitalRecords
      .filter((x) => x.participantId === participantId)
      .sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt))
      .slice(0, limit);
  }
  async createMedicationPlan(participantId, plan) {
    const value = { id: randomUUID(), participantId, active: true, ...plan };
    this.medicationPlans.push(value);
    return value;
  }
  async listMedicationPlans(participantId) {
    return this.medicationPlans.filter((x) => x.participantId === participantId && x.active);
  }
  async deactivateMedicationPlan(participantId, planId) {
    const plan = this.medicationPlans.find((x) => x.id === planId && x.participantId === participantId && x.active);
    if (!plan) return false;
    plan.active = false;
    return true;
  }
  async createMedicationRecord(participantId, record) {
    const value = { id: randomUUID(), participantId, ...record };
    this.medicationRecords.push(value);
    this.auditEvents.push({ actorId: participantId, eventType: 'medication.created' });
    return value;
  }
  async listMedicationRecords(participantId, limit = 90) {
    return this.medicationRecords
      .filter((x) => x.participantId === participantId)
      .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt))
      .slice(0, limit);
  }
  async createMealRecord(participantId, record) {
    const value = { id: randomUUID(), participantId, ...record };
    this.mealRecords.push(value);
    this.auditEvents.push({ actorId: participantId, eventType: 'meal.created' });
    return value;
  }
  async listMealRecords(participantId, limit = 90) {
    return this.mealRecords
      .filter((x) => x.participantId === participantId)
      .sort((a, b) => new Date(b.eatenAt) - new Date(a.eatenAt))
      .slice(0, limit);
  }
  async recordFollowUp(relationshipId, user, action) {
    const relationship = this.relationships.find((r) => r.id === relationshipId && r.supporterId === user.id && r.status === 'active');
    if (!relationship || user.role !== 'supporter') return null;
    const value = { id: randomUUID(), relationshipId, actorId: user.id, action }; this.followUps.push(value); this.auditEvents.push({ actorId: user.id, eventType: 'followup.created' }); return value;
  }
  async listSharedCheckIns(relationshipId, user) {
    const relationship = this.relationships.find((r) => r.id === relationshipId && r.supporterId === user.id && r.status === 'active');
    if (!relationship || user.role !== 'supporter' || !relationship.scopes?.includes('checkin_summary')) return null;
    return this.checkIns
      .filter((record) => record.participantId === relationship.participantId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map((record) => ({ id: record.id, summary: record.result, createdAt: record.createdAt || this.now() }));
  }
}
