import { digest } from '../domain.mjs';
import { requiresSolicitorCheck } from '../jm-letvest-pack.mjs';
import { redactPersonalData } from '../llm-adapter.mjs';

export const READ_TOOLS = [
  'overdue_rent',
  'expiring_certificates',
  'open_tickets',
  'void_rooms',
  'pipeline_summary',
  'property_pnl'
];

export const DRAFT_TOOLS = [
  'create_draft_message',
  'create_job_request',
  'create_landlord_statement'
];

export const STATUTORY_CERTIFICATE_KINDS = ['CP12', 'EICR', 'PAT', 'EPC', 'HMO Licence'];

const PRIORITY_ORDER = {
  Emergency: 0,
  Urgent: 1,
  Routine: 2
};

function assertToolAllowed(employeeRecord, toolName, kind = 'read') {
  const allowedList =
    kind === 'read'
      ? employeeRecord?.data?.allowedTools?.read || employeeRecord?.data?.tools || []
      : employeeRecord?.data?.allowedTools?.draft || employeeRecord?.data?.tools || [];
  if (!allowedList.includes(toolName)) {
    throw Object.assign(
      new Error(`Role "${employeeRecord?.data?.role || 'unknown'}" is not authorised to call ${kind} tool "${toolName}"`),
      { code: 'TOOL_NOT_ALLOWED', status: 403 }
    );
  }
}

async function fetchSnapshotOrDedicatedRpc(rlsClient, toolName, params = {}) {
  try {
    const dedicated = await rlsClient.rpc('jm_letvest_ai_read', {
      tool_name: toolName,
      params
    });
    if (dedicated && typeof dedicated === 'object') {
      return { mode: 'dedicated_rpc', payload: dedicated };
    }
  } catch (err) {
    // Fallback to existing public.jm_letvest_snapshot() when jm_letvest_ai_read migration has not yet been applied
    if (err.code === 'SERVICE_ROLE_FORBIDDEN') throw err;
  }
  const snapshot = await rlsClient.rpc('jm_letvest_snapshot', {});
  return { mode: 'snapshot_rpc', payload: snapshot || {} };
}

function diffDays(targetIsoDate, referenceIsoDate) {
  const target = Date.parse(targetIsoDate + 'T00:00:00Z');
  const ref = Date.parse(referenceIsoDate + 'T00:00:00Z');
  return Math.round((target - ref) / 86400000);
}

export async function runReadTool({
  team,
  member,
  assignmentId,
  employeeRecord,
  rlsClient,
  toolName,
  params = {},
  redactPii = true
}) {
  assertToolAllowed(employeeRecord, toolName, 'read');
  const referenceDate = params.referenceDate || new Date().toISOString().slice(0, 10);
  const { mode, payload } = await fetchSnapshotOrDedicatedRpc(rlsClient, toolName, { ...params, referenceDate });

  let rawResult;
  if (mode === 'dedicated_rpc' && Array.isArray(payload.records)) {
    rawResult = {
      toolName,
      referenceDate,
      records: payload.records,
      missingData: payload.missingData || []
    };
  } else {
    const properties = payload.properties || [];
    const deals = payload.deals || [];
    const tickets = payload.tickets || [];
    const payments = payload.payments || [];
    const contractors = payload.contractors || [];

    switch (toolName) {
      case 'overdue_rent': {
        const overdue = payments
          .filter(p => !p.paid && p.due && String(p.due) < referenceDate)
          .map(p => {
            const daysOverdue = Math.abs(diffDays(String(p.due), referenceDate));
            const tier =
              daysOverdue >= 14
                ? 'Tier 3 (Day 14+ Owner & Solicitor Escalation)'
                : daysOverdue >= 4
                  ? 'Tier 2 (Day 4-13 Formal Arrears Follow-Up)'
                  : 'Tier 1 (Day 1-3 Courtesy Reminder)';
            return {
              id: p.id,
              citation: `[record:rent_payments:${p.id}]`,
              property_id: p.propertyId,
              room: p.room,
              tenant_name: p.tenant,
              due_on: p.due,
              days_overdue: daysOverdue,
              amount: Number(p.amount || 0),
              sop_tier: tier,
              check_with_solicitor: true
            };
          });
        rawResult = {
          toolName,
          referenceDate,
          totalOverdueGbp: overdue.reduce((s, r) => s + r.amount, 0),
          records: overdue,
          missingData: overdue.length === 0 && payments.length === 0 ? ['No rent_payments records returned by RPC'] : []
        };
        break;
      }

      case 'expiring_certificates': {
        const withinDays = Number(params.withinDays ?? 30);
        const records = [];
        const missingData = [];

        for (const prop of properties) {
          const certs = prop.certificates || {};
          for (const kind of STATUTORY_CERTIFICATE_KINDS) {
            const expiry = certs[kind];
            if (!expiry) {
              missingData.push(
                `INSUFFICIENT_DATA: Missing ${kind} certificate record for property ${prop.address} ([record:properties:${prop.id}])`
              );
              continue;
            }
            const daysRemaining = diffDays(String(expiry), referenceDate);
            if (daysRemaining <= withinDays) {
              records.push({
                id: `${prop.id}:${kind}`,
                citation: `[record:certificates:${prop.id}:${kind}]`,
                property_id: prop.id,
                property_address: prop.address,
                kind,
                expires_on: expiry,
                days_remaining: daysRemaining,
                status: daysRemaining < 0 ? 'EXPIRED' : 'EXPIRING_WITHIN_30_DAYS',
                check_with_solicitor: daysRemaining < 0 || kind === 'HMO Licence'
              });
            }
          }
        }
        rawResult = {
          toolName,
          referenceDate,
          withinDays,
          records,
          missingData
        };
        break;
      }

      case 'open_tickets': {
        const validContractors = contractors.filter(
          c => c.insurance_expires_on && String(c.insurance_expires_on) > referenceDate
        );
        const open = tickets
          .filter(t => t.status !== 'Resolved')
          .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
          .map(t => ({
            id: t.id,
            citation: `[record:maintenance_tickets:${t.id}]`,
            property_id: t.propertyId,
            room: t.room,
            title: t.title,
            description: t.description || '',
            priority: t.priority,
            status: t.status,
            contractor: t.contractor || null,
            created_at: t.createdAt,
            available_vetted_contractors: validContractors.map(c => ({
              id: c.id,
              name: c.name,
              trade: c.trade,
              insurance_expires_on: c.insurance_expires_on,
              citation: `[record:contractors:${c.id}]`
            }))
          }));
        rawResult = {
          toolName,
          referenceDate,
          records: open,
          missingData:
            contractors.length === 0
              ? ['INSUFFICIENT_DATA: Contractor register (vetting_reference & insurance_expires_on) not returned by snapshot RPC']
              : []
        };
        break;
      }

      case 'void_rooms': {
        const records = [];
        const missingData = [];
        for (const prop of properties) {
          const totalRooms = Number(prop.rooms || 0);
          const occupiedRooms = Number(prop.occupied || 0);
          const voidCount = Math.max(0, totalRooms - occupiedRooms);
          if (Array.isArray(prop.voidRoomDetails)) {
            for (const vr of prop.voidRoomDetails) {
              records.push({
                id: vr.id,
                citation: `[record:rooms:${vr.id}]`,
                property_id: prop.id,
                property_address: prop.address,
                room_name: vr.name,
                advertised_rent: Number(vr.advertised_rent || prop.roomRent || 0)
              });
            }
          } else if (voidCount > 0) {
            records.push({
              id: `${prop.id}:void-summary`,
              citation: `[record:properties:${prop.id}]`,
              property_id: prop.id,
              property_address: prop.address,
              void_room_count: voidCount,
              estimated_monthly_void_loss: voidCount * Number(prop.roomRent || 0)
            });
            missingData.push(
              `INSUFFICIENT_DATA: Individual room IDs for ${voidCount} void room(s) at ${prop.address} require jm_letvest_ai_read RPC`
            );
          }
        }
        rawResult = {
          toolName,
          referenceDate,
          records,
          missingData
        };
        break;
      }

      case 'pipeline_summary': {
        const stageNames = {
          0: 'Lead Identified',
          1: 'Initial Landlord Contact',
          2: 'Viewing & Property Inspection',
          3: 'Deal Analyser & Guaranteed Rent Offer Drafted',
          4: 'Head Lease Heads of Terms / Solicitor Review'
        };
        const records = deals.map(d => {
          const rooms = Number(d.rooms || 0);
          const spread = Number(d.potentialSpread ?? d.potential_spread ?? 0);
          const spreadPerRoom = rooms > 0 ? Number((spread / rooms).toFixed(2)) : 0;
          return {
            id: d.id,
            citation: `[record:deals:${d.id}]`,
            address: d.address,
            contact_name: d.contact,
            rooms,
            stage: Number(d.stage || 0),
            stage_label: stageNames[d.stage] || 'Unknown',
            potential_spread: spread,
            spread_per_room: spreadPerRoom,
            meets_sop04_baseline: spreadPerRoom >= 150
          };
        });
        rawResult = {
          toolName,
          referenceDate,
          totalDeals: records.length,
          records,
          missingData: []
        };
        break;
      }

      case 'property_pnl': {
        const records = properties.map(prop => {
          const occupied = Number(prop.occupied || 0);
          const rooms = Number(prop.rooms || 0);
          const roomRent = Number(prop.roomRent || 0);
          const scheduledRevenue = Number(prop.revenue ?? occupied * roomRent);
          const headRent = Number(prop.headRent ?? prop.head_rent ?? 0);
          const expenses = Number(prop.expenses ?? 0);
          const voidLoss = Math.max(0, rooms - occupied) * roomRent;
          const netSpread = scheduledRevenue - headRent - expenses;
          return {
            id: prop.id,
            citation: `[record:property_pnl:${prop.id}]`,
            address: prop.address,
            rooms,
            occupied,
            scheduled_revenue: scheduledRevenue,
            head_rent: headRent,
            expenses,
            void_loss: voidLoss,
            net_spread: netSpread
          };
        });
        rawResult = {
          toolName,
          referenceDate,
          portfolioTotals: {
            scheduled_revenue: records.reduce((s, r) => s + r.scheduled_revenue, 0),
            head_rent: records.reduce((s, r) => s + r.head_rent, 0),
            expenses: records.reduce((s, r) => s + r.expenses, 0),
            void_loss: records.reduce((s, r) => s + r.void_loss, 0),
            net_spread: records.reduce((s, r) => s + r.net_spread, 0)
          },
          records,
          missingData: []
        };
        break;
      }

      default:
        throw new Error(`Unsupported read tool: ${toolName}`);
    }
  }

  const finalData = redactPii ? redactPersonalData(rawResult).redacted : rawResult;
  if (team && member && assignmentId) {
    team.event(member, assignmentId, 'tool_read_executed', {
      toolName,
      recordCount: Array.isArray(finalData.records) ? finalData.records.length : 0
    });
  }
  return {
    toolName,
    verified: true,
    data: finalData
  };
}

function enqueueDraftWithApproval({
  team,
  member,
  assignmentId,
  employeeRecord,
  toolName,
  draftType,
  actionSummary,
  destination,
  payload
}) {
  assertToolAllowed(employeeRecord, toolName, 'draft');
  if (!Array.isArray(payload.citations) || payload.citations.length === 0) {
    throw Object.assign(
      new Error(`Draft tool "${toolName}" requires at least one source or record citation`),
      { code: 'MISSING_CITATIONS', status: 400 }
    );
  }

  const assignment = team.get(member, assignmentId, 'assignment');
  const solicitorFlag =
    payload.check_with_solicitor === true ||
    payload.checkWithSolicitor === true ||
    toolName === 'create_landlord_statement' ||
    requiresSolicitorCheck(payload, employeeRecord.data);

  return team.tx(() => {
    const draftRecord = team.create(
      member,
      'draft_action',
      {
        assignment: assignmentId,
        employeeId: employeeRecord.id,
        role: employeeRecord.data.role,
        toolName,
        draftType,
        status: 'pending_approval',
        sent: false,
        dispatched: false,
        requiresApproval: true,
        checkWithSolicitor: solicitorFlag,
        solicitorBanner: solicitorFlag ? '[CHECK WITH A SOLICITOR]' : null,
        payload,
        citations: payload.citations
      },
      assignment.scope
    );

    const approvalRecord = team.create(
      member,
      'approval',
      {
        assignment: assignmentId,
        draftId: draftRecord.id,
        revision: assignment.data.revision,
        status: 'pending',
        action: solicitorFlag ? `${actionSummary} [CHECK WITH A SOLICITOR]` : actionSummary,
        destination,
        checkWithSolicitor: solicitorFlag,
        payload: {
          draftId: draftRecord.id,
          draftType,
          ...payload
        },
        digest: digest({
          assignment: assignment.id,
          configuration: assignment.data.configurationVersion,
          sourceIds: assignment.data.sourceIds,
          sourceVersions: assignment.data.sourceVersions,
          revision: assignment.data.revision
        }),
        expires: new Date(Date.now() + 86400000).toISOString()
      },
      assignment.scope
    );

    team.save(member, assignment, {
      ...assignment.data,
      requiresApproval: true,
      checkWithSolicitor: assignment.data.checkWithSolicitor || solicitorFlag,
      status: 'awaiting_approval'
    });
    team.db.prepare("UPDATE jobs SET state='waiting' WHERE assignment=?").run(assignmentId);
    team.event(member, assignmentId, 'draft_queued_for_approval', {
      draftId: draftRecord.id,
      approvalId: approvalRecord.id,
      toolName,
      draftType,
      checkWithSolicitor: solicitorFlag
    });

    return {
      draft: draftRecord,
      approval: approvalRecord
    };
  });
}

export function createDraftMessage({ team, member, assignmentId, employeeRecord, payload }) {
  if (!payload?.subject?.trim() || !payload?.body?.trim() || !payload?.recipientRole?.trim()) {
    throw new Error('create_draft_message requires recipientRole, subject, body, and citations');
  }
  return enqueueDraftWithApproval({
    team,
    member,
    assignmentId,
    employeeRecord,
    toolName: 'create_draft_message',
    draftType: 'draft_message',
    actionSummary: `Draft message to ${payload.recipientRole}: ${payload.subject.trim()}`,
    destination: 'approval_queue (no automatic send)',
    payload
  });
}

export function createJobRequest({ team, member, assignmentId, employeeRecord, payload }) {
  if (!payload?.propertyId?.trim() || !payload?.contractorId?.trim() || !payload?.scopeOfWork?.trim()) {
    throw new Error('create_job_request requires propertyId, contractorId, scopeOfWork, and citations');
  }
  return enqueueDraftWithApproval({
    team,
    member,
    assignmentId,
    employeeRecord,
    toolName: 'create_job_request',
    draftType: 'job_request',
    actionSummary: `Draft contractor job request (${payload.contractorId}) for ${payload.propertyId}`,
    destination: 'approval_queue (no automatic contractor dispatch)',
    payload: {
      ...payload,
      spendingCapGbp: Number(payload.spendingCapGbp || 0)
    }
  });
}

export function createLandlordStatement({ team, member, assignmentId, employeeRecord, payload }) {
  if (!payload?.propertyId?.trim() || !payload?.masterLeaseId?.trim() || !payload?.periodMonth?.trim()) {
    throw new Error('create_landlord_statement requires propertyId, masterLeaseId, periodMonth, headRentDueGbp, and citations');
  }
  const headRentDueGbp = Number(payload.headRentDueGbp || 0);
  const deductionsGbp = Number(payload.deductionsGbp || 0);
  const netPayableGbp = Number((headRentDueGbp - deductionsGbp).toFixed(2));
  return enqueueDraftWithApproval({
    team,
    member,
    assignmentId,
    employeeRecord,
    toolName: 'create_landlord_statement',
    draftType: 'landlord_statement',
    actionSummary: `Draft monthly landlord statement (${payload.periodMonth}) for ${payload.propertyId}`,
    destination: 'approval_queue (no automatic statement dispatch or payment)',
    payload: {
      ...payload,
      headRentDueGbp,
      deductionsGbp,
      netPayableGbp,
      check_with_solicitor: true
    }
  });
}
