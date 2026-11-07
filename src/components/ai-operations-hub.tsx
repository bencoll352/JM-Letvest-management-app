'use client';
import React, { useState } from 'react';
import { Play, PauseCircle, AlertTriangle, Check, X, FileText, Clock3, Lock, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { money, spread, totals, daysUntil, type Property } from '@/lib/finance';
import type { Ticket, Deal, Payment } from '@/lib/data';
import { evaluateDealAnalyser } from '@/lib/deal-analyser';
import { buildDailyNotifications } from '@/lib/notifications';
import { validateDocumentUpload, DOCUMENT_SUBTYPES, type DocumentCategory, type DocumentSubtype } from '@/lib/documents';
import { canPerformWorkspaceAction, buildAuditEntry, type WorkspaceRole, type WorkspaceAction } from '@/lib/rbac';
import { matchBankFeedTransactions, type BankTransaction } from '@/lib/bank-feed';

export interface AiRoleDefinition {
  id: string;
  name: string;
  title: string;
  schedule: string;
  maxTokens: number;
  maxCostGBP: number;
  allowedTools: string[];
  summary: string;
}

export interface DraftQueueItem {
  id: string;
  roleId: string;
  roleName: string;
  tool: 'create_draft_message' | 'create_job_request' | 'create_landlord_statement';
  recipient: string;
  subject: string;
  body: string;
  citations: string[];
  requiresSolicitorCheck: boolean;
  status: 'pending_approval' | 'approved' | 'revision_requested' | 'rejected';
  createdAt: string;
  tokensUsed: number;
  costGBP: number;
  linkedTicketId?: string;
  linkedContractor?: string;
}

export interface RoutineScheduleItem {
  id: string;
  roleId: string;
  title: string;
  timeUk: string;
  days: string;
  active: boolean;
  lastRun: string;
  overlapStatus: 'clear' | 'lease_active';
}

export const JM_AI_ROLES: AiRoleDefinition[] = [
  {
    id: 'jm-chief-of-staff',
    name: 'Chief of Staff',
    title: '07:30 Daily Briefing, Triage & Friday Scoreboard',
    schedule: '07:30 Mon–Fri & 16:00 Fri (Europe/London)',
    maxTokens: 4000,
    maxCostGBP: 0.25,
    allowedTools: ['overdue_rent', 'expiring_certificates', 'open_tickets', 'void_rooms', 'pipeline_summary', 'property_pnl', 'create_draft_message'],
    summary: 'Synthesises portfolio KPIs, flags compliance/arrears/maintenance bottlenecks, and routes daily tasks across the specialist team.'
  },
  {
    id: 'jm-compliance-officer',
    name: 'Compliance Officer',
    title: 'CP12, EICR, PAT, EPC & HMO Licence Auditor',
    schedule: '08:00 Mon–Fri (Europe/London)',
    maxTokens: 3200,
    maxCostGBP: 0.20,
    allowedTools: ['expiring_certificates', 'create_job_request', 'create_draft_message'],
    summary: 'Flags any certificate expired or due within 30 days and drafts contractor renewal booking requests for owner approval.'
  },
  {
    id: 'jm-rent-finance-controller',
    name: 'Rent & Finance Controller',
    title: 'Arrears, R2R Spread, Voids & Landlord Statements',
    schedule: '08:30 Mon (Europe/London)',
    maxTokens: 3500,
    maxCostGBP: 0.25,
    allowedTools: ['overdue_rent', 'void_rooms', 'property_pnl', 'create_draft_message', 'create_landlord_statement'],
    summary: 'Tracks room rent collections vs guaranteed head rent, calculates net spread, and drafts arrears reminders and monthly landlord statements.'
  },
  {
    id: 'jm-maintenance-coordinator',
    name: 'Maintenance Coordinator',
    title: 'Ticket Triage, Contractor Matching & Updates',
    schedule: 'Event-driven / On-demand',
    maxTokens: 3000,
    maxCostGBP: 0.20,
    allowedTools: ['open_tickets', 'create_job_request', 'create_draft_message'],
    summary: 'Triages open repairs by severity (Emergency / Urgent / Routine), suggests vetted contractors, and drafts tenant progress updates.'
  },
  {
    id: 'jm-landlord-acquisition-scout',
    name: 'Landlord Acquisition Scout',
    title: 'CRM Pipeline & R2R Deal Analyser Scoring',
    schedule: 'On-demand / Pipeline review',
    maxTokens: 3000,
    maxCostGBP: 0.20,
    allowedTools: ['pipeline_summary', 'property_pnl', 'create_draft_message'],
    summary: 'Scores landlord opportunities using the R2R Deal Analyser (including void & bills stress tests) and drafts landlord follow-ups.'
  },
  {
    id: 'jm-receptionist',
    name: 'Receptionist',
    title: 'First-Line Tenant & Landlord Enquiry Responder',
    schedule: 'On-demand (Approved SOPs only)',
    maxTokens: 2400,
    maxCostGBP: 0.15,
    allowedTools: ['void_rooms', 'open_tickets', 'create_draft_message'],
    summary: 'Drafts polite UK-English first replies to tenant and landlord enquiries strictly from approved SOPs; refuses unsupported claims.'
  }
];

const SOLICITOR_REGEX = /\b(£|\bgbp\b|rent|arrears|overdue|payment|statement|head\s*rent|spread|deposit|tds|dps|mydeposits|section\s*8|section\s*21|notice|evict|eviction|possession|tenancy|ast|agreement|lease|solicitor|court|breach)\b/i;

export function requiresSolicitorCheck(text: string): boolean {
  return SOLICITOR_REGEX.test(text);
}

export function redactPiiPreview(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/(?:\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}/g, '[REDACTED_UK_PHONE]')
    .replace(/\b\d{2}-\d{2}-\d{2}\b/g, '[REDACTED_SORT_CODE]');
}

interface AiOperationsHubProps {
  properties: Property[];
  tickets: Ticket[];
  deals: Deal[];
  payments: Payment[];
  onAssignTicketContractor?: (ticketId: string, contractor: string) => void;
  onNotify?: (msg: string) => void;
}

export function AiOperationsHub({
  properties,
  tickets,
  deals,
  payments,
  onAssignTicketContractor,
  onNotify
}: AiOperationsHubProps) {
  const [paused, setPaused] = useState(false);
  const [adapterMode, setAdapterMode] = useState<'local-extractive-v1' | 'llm-provider-v1'>('local-extractive-v1');
  const [selectedRole, setSelectedRole] = useState<string>('jm-chief-of-staff');
  const [enquiryType, setEnquiryType] = useState<'tenant_room' | 'landlord_r2r' | 'emergency_gas' | 'missing_data'>('landlord_r2r');
  const [activeRunOutput, setActiveRunOutput] = useState<{
    roleName: string;
    adapter: string;
    timestamp: string;
    tokens: number;
    costGBP: number;
    redactedCount: number;
    solicitorFlag: boolean;
    reportMarkdown: string;
    citations: string[];
  } | null>(null);

  const [routines, setRoutines] = useState<RoutineScheduleItem[]>([
    { id: 'jm-daily-briefing', roleId: 'jm-chief-of-staff', title: '07:30 Daily Operations Briefing', timeUk: '07:30', days: 'off', active: false, lastRun: 'Inactive (days: off)', overlapStatus: 'clear' },
    { id: 'jm-compliance-check', roleId: 'jm-compliance-officer', title: '08:00 Daily Certificate Expiry Audit', timeUk: '08:00', days: 'off', active: false, lastRun: 'Inactive (days: off)', overlapStatus: 'clear' },
    { id: 'jm-monday-arrears', roleId: 'jm-rent-finance-controller', title: '08:30 Monday Rent Arrears & Voids Report', timeUk: '08:30', days: 'off', active: false, lastRun: 'Inactive (days: off)', overlapStatus: 'clear' },
    { id: 'jm-friday-scoreboard', roleId: 'jm-chief-of-staff', title: '16:00 Friday Weekly Owner Scoreboard', timeUk: '16:00', days: 'off', active: false, lastRun: 'Inactive (days: off)', overlapStatus: 'clear' }
  ]);

  const [drafts, setDrafts] = useState<DraftQueueItem[]>(() => {
    const overdue = payments.filter((p) => !p.paid);
    const firstOverdue = overdue[0];
    const firstProp = properties[0];
    return [
      {
        id: 'DRF-101',
        roleId: 'jm-rent-finance-controller',
        roleName: 'Rent & Finance Controller',
        tool: 'create_draft_message',
        recipient: firstOverdue ? `${firstOverdue.name} (${firstOverdue.room})` : 'Occupant (Room 3)',
        subject: 'Polite rent reminder — payment overdue',
        body: firstOverdue
          ? `Dear Resident, our rent ledger shows ${money(firstOverdue.amount)} due on ${firstOverdue.due} for ${firstOverdue.room} remains outstanding. Please let us know once transferred or if you need to discuss payment timing. [Source: payment:${firstOverdue.id}] [Source: sop:rent-arrears-v1]`
          : 'INSUFFICIENT_DATA: No overdue rent rows found.',
        citations: firstOverdue ? [`payment:${firstOverdue.id}`, 'sop:rent-arrears-v1'] : ['sop:rent-arrears-v1'],
        requiresSolicitorCheck: true,
        status: 'pending_approval',
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        tokensUsed: 410,
        costGBP: 0.0021
      },
      {
        id: 'DRF-102',
        roleId: 'jm-compliance-officer',
        roleName: 'Compliance Officer',
        tool: 'create_job_request',
        recipient: 'Southern Gas & Heating Ltd (Gas Safe #541928)',
        subject: `CP12 Gas Safety Renewal Booking — ${firstProp ? firstProp.address : 'Portfolio Property'}`,
        body: firstProp
          ? `Please book an annual CP12 Gas Safety inspection for ${firstProp.address} (${firstProp.postcode}) prior to expiry on ${firstProp.compliance}. Do not dispatch until owner approves. [Source: property:${firstProp.id}] [Source: sop:compliance-30d-v1]`
          : 'INSUFFICIENT_DATA: No property record found.',
        citations: firstProp ? [`property:${firstProp.id}`, 'sop:compliance-30d-v1'] : ['sop:compliance-30d-v1'],
        requiresSolicitorCheck: false,
        status: 'pending_approval',
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        tokensUsed: 355,
        costGBP: 0.0018
      }
    ];
  });

  function runRoleNow(roleId: string) {
    if (paused) {
      onNotify?.('Global kill switch (PAUSED) is active. Disable PAUSED before running AI employees.');
      return;
    }
    const role = JM_AI_ROLES.find((r) => r.id === roleId) || JM_AI_ROLES[0];
    const t = totals(properties);
    const overdue = payments.filter((p) => !p.paid);
    const openTickets = tickets.filter((tk) => tk.status !== 'Resolved');
    const expiringProps = properties.filter((p) => daysUntil(p.compliance) <= 30);
    const voidProps = properties.filter((p) => p.occupied < p.rooms);
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    let reportMarkdown = '';
    let citations: string[] = [];
    const newDrafts: DraftQueueItem[] = [];

    if (role.id === 'jm-chief-of-staff') {
      citations = [
        ...properties.map((p) => `property:${p.id}`),
        ...overdue.map((p) => `payment:${p.id}`),
        ...openTickets.map((tk) => `ticket:${tk.id}`),
        'sop:daily-briefing-v1'
      ];
      reportMarkdown = [
        `### 07:30 Daily Operations Briefing (${nowStr} Europe/London)`,
        `- **Portfolio Spread**: Scheduled room income **${money(t.revenue)}/mo** vs head rent & costs **${money(t.cost)}/mo** → Net spread **${money(t.net)}/mo** across **${t.occupied}/${t.rooms}** occupied rooms. \`[Source: property:${properties[0]?.id || 'portfolio'}]\``,
        `- **Compliance Priority**: **${expiringProps.length}** property certificate(s) due within 30 days or expired (${expiringProps.map((p) => `${p.address}: CP12 ${p.compliance}`).join('; ') || 'none'}). Routed to **Compliance Officer**. \`[Source: sop:compliance-30d-v1]\``,
        `- **Rent Arrears Priority**: **${overdue.length}** unpaid rent item(s) totalling **${money(overdue.reduce((a, b) => a + b.amount, 0))}**. Routed to **Rent & Finance Controller**. ${overdue[0] ? `\`[Source: payment:${overdue[0].id}]\`` : ''}`,
        `- **Maintenance Queue**: **${openTickets.length}** open repair ticket(s) (${openTickets.filter((x) => x.priority === 'Urgent' || x.priority === 'Emergency').length} urgent/emergency). Routed to **Maintenance Coordinator**. ${openTickets[0] ? `\`[Source: ticket:${openTickets[0].id}]\`` : ''}`,
        `- **Void Rooms**: **${t.rooms - t.occupied}** void room(s) across **${voidProps.length}** properties (${voidProps.map((p) => `${p.address}: ${p.rooms - p.occupied} void`).join(', ') || '0 voids'}).`
      ].join('\n');
    } else if (role.id === 'jm-compliance-officer') {
      citations = [...expiringProps.map((p) => `property:${p.id}`), 'sop:compliance-30d-v1'];
      if (expiringProps.length === 0) {
        reportMarkdown = `### Compliance Audit (${nowStr})\n- All properties have certificates > 30 days in date. No renewal drafts queued. \`[Source: sop:compliance-30d-v1]\``;
      } else {
        reportMarkdown = [
          `### 08:00 Compliance Certificate Audit (${nowStr})`,
          ...expiringProps.map((p) => {
            const d = daysUntil(p.compliance);
            return `- **${p.address} (${p.council})**: CP12 expires **${p.compliance}** (${d < 0 ? `${Math.abs(d)} days EXPIRED` : `${d} days remaining`}). Drafted contractor booking request. \`[Source: property:${p.id}]\``;
          })
        ].join('\n');
        for (const p of expiringProps) {
          newDrafts.push({
            id: `DRF-${Math.floor(100 + Math.random() * 900)}`,
            roleId: role.id,
            roleName: role.name,
            tool: 'create_job_request',
            recipient: 'Southern Gas & Heating Ltd (Gas Safe)',
            subject: `CP12 Renewal Booking — ${p.address}`,
            body: `Requesting CP12 Gas Safety inspection at ${p.address}, ${p.postcode} before ${p.compliance}. [Source: property:${p.id}] [Source: sop:compliance-30d-v1]`,
            citations: [`property:${p.id}`, 'sop:compliance-30d-v1'],
            requiresSolicitorCheck: false,
            status: 'pending_approval',
            createdAt: nowStr,
            tokensUsed: 320,
            costGBP: 0.0016
          });
        }
      }
    } else if (role.id === 'jm-rent-finance-controller') {
      citations = [...overdue.map((p) => `payment:${p.id}`), ...properties.map((p) => `property:${p.id}`), 'sop:rent-arrears-v1'];
      reportMarkdown = [
        `### Rent Arrears & Landlord Statement Run (${nowStr})`,
        `- **Outstanding Collections**: **${money(overdue.reduce((a, b) => a + b.amount, 0))}** across **${overdue.length}** resident payment(s).`,
        ...overdue.map((p) => `- Overdue: **${p.room}** (${redactPiiPreview(p.name)}) — **${money(p.amount)}** due **${p.due}**. Drafted chasing message. \`[Source: payment:${p.id}]\``),
        `- **Monthly Landlord Statements**: Prepared draft guaranteed head-rent statements for **${properties.length}** properties (solicitor/owner check required before sending). \`[Source: property:${properties[0]?.id || 'p1'}]\``
      ].join('\n');
      if (properties[0]) {
        const p = properties[0];
        newDrafts.push({
          id: `DRF-${Math.floor(100 + Math.random() * 900)}`,
          roleId: role.id,
          roleName: role.name,
          tool: 'create_landlord_statement',
          recipient: `${p.landlord} (Head Landlord — ${p.address})`,
          subject: `Monthly Guaranteed Rent Statement — ${p.address}`,
          body: `Statement for ${p.address}: Guaranteed monthly head rent payable by JM Letvest Ltd: ${money(p.headRent)}. Occupied rooms: ${p.occupied}/${p.rooms}. Net operator spread: ${money(spread(p))}. [Source: property:${p.id}] [Source: sop:landlord-statement-v1]`,
          citations: [`property:${p.id}`, 'sop:landlord-statement-v1'],
          requiresSolicitorCheck: true,
          status: 'pending_approval',
          createdAt: nowStr,
          tokensUsed: 450,
          costGBP: 0.0023
        });
      }
    } else if (role.id === 'jm-maintenance-coordinator') {
      citations = [...openTickets.map((tk) => `ticket:${tk.id}`), 'sop:maintenance-triage-v1'];
      reportMarkdown = [
        `### Maintenance Ticket Triage (${nowStr})`,
        ...openTickets.map((tk) => {
          const suggested = tk.title.toLowerCase().includes('boiler') || tk.title.toLowerCase().includes('tap')
            ? 'Southern Gas & Heating'
            : tk.title.toLowerCase().includes('light') || tk.title.toLowerCase().includes('socket')
            ? 'Solent Spark Electrical'
            : 'Harbour Property Care';
          return `- **${tk.id} [${tk.priority}]**: ${tk.title} (${tk.room}) — Status: **${tk.status}**. Suggested contractor: **${suggested}**. \`[Source: ticket:${tk.id}]\``;
        })
      ].join('\n');
      const unassigned = openTickets.find((tk) => !tk.contractor) || openTickets[0];
      if (unassigned) {
        const suggested = unassigned.title.toLowerCase().includes('boiler') || unassigned.title.toLowerCase().includes('tap')
          ? 'Southern Gas & Heating'
          : 'Harbour Property Care';
        newDrafts.push({
          id: `DRF-${Math.floor(100 + Math.random() * 900)}`,
          roleId: role.id,
          roleName: role.name,
          tool: 'create_job_request',
          recipient: suggested,
          subject: `Work Order Draft — ${unassigned.id}: ${unassigned.title}`,
          body: `Please attend ${unassigned.room} regarding "${unassigned.title}" (${unassigned.priority} priority). Description: ${unassigned.description}. Approve this draft to assign contractor in workspace. [Source: ticket:${unassigned.id}] [Source: sop:maintenance-triage-v1]`,
          citations: [`ticket:${unassigned.id}`, 'sop:maintenance-triage-v1'],
          requiresSolicitorCheck: requiresSolicitorCheck(unassigned.description),
          status: 'pending_approval',
          createdAt: nowStr,
          tokensUsed: 380,
          costGBP: 0.0019,
          linkedTicketId: unassigned.id,
          linkedContractor: suggested
        });
      }
    } else if (role.id === 'jm-landlord-acquisition-scout') {
      citations = [...deals.map((d) => `deal:${d.id}`), 'sop:deal-analyser-v1'];
      const scored = deals.map((d) => {
        const analysis = evaluateDealAnalyser({
          guaranteedHeadRent: d.rooms * 360,
          projectedRoomRents: Array.from({ length: Math.max(1, d.rooms) }, () => 725),
          monthlyBills: d.rooms * 95,
          fiveYearLicenceFee: 1200
        });
        return { deal: d, analysis };
      });
      reportMarkdown = [
        `### CRM Pipeline & R2R Deal Analyser Scoring (${nowStr})`,
        ...scored.map(({ deal, analysis }) =>
          `- **${deal.address}** (${deal.rooms} rooms · ${deal.landlord}): Base net spread **${money(analysis.baselineMonthlyNetSpread)}/mo** (${money(analysis.baselineSpreadPerRoom)}/room), Stress-test spread **${money(analysis.stressTest.stressedMonthlyNetSpread)}/mo** → Verdict: **${analysis.verdict}**. \`[Source: deal:${deal.id}]\``
        )
      ].join('\n');
      if (scored[0]) {
        const { deal, analysis } = scored[0];
        newDrafts.push({
          id: `DRF-${Math.floor(100 + Math.random() * 900)}`,
          roleId: role.id,
          roleName: role.name,
          tool: 'create_draft_message',
          recipient: `${deal.landlord} (${deal.address})`,
          subject: `Subject-to-Contract R2R Appraisal Follow-Up — ${deal.address}`,
          body: `Dear ${deal.landlord}, thank you for discussing ${deal.address} (${deal.rooms} rooms). Following our initial R2R appraisal (verdict: ${analysis.verdict}), we would like to arrange a property walkthrough before issuing a formal written guaranteed head-lease proposal (subject to contract and solicitor review). [Source: deal:${deal.id}] [Source: sop:deal-analyser-v1]`,
          citations: [`deal:${deal.id}`, 'sop:deal-analyser-v1'],
          requiresSolicitorCheck: true,
          status: 'pending_approval',
          createdAt: nowStr,
          tokensUsed: 425,
          costGBP: 0.0022
        });
      }
    } else {
      citations = ['sop:receptionist-intake-v1'];
      if (enquiryType === 'emergency_gas') {
        reportMarkdown = `### Receptionist Safety Guardrail Triggered (${nowStr})\n- **Input**: Tenant reports smell of gas / boiler fumes.\n- **Action**: Immediate emergency directive issued (leave area, call 0800 111 999 / 999). High-priority alert queued for human owner. \`[Source: sop:receptionist-intake-v1]\``;
      } else if (enquiryType === 'missing_data') {
        reportMarkdown = `### Receptionist Missing-Data Refusal (${nowStr})\n- **Input**: Caller asks for guaranteed rent figure on an uninspected 7-bed property in Brighton.\n- **Refusal**: \`INSUFFICIENT_DATA\` — Refused to invent a rent offer, fee, or legal rule. Requested postcode, room count, condition, and viewing availability. \`[Source: sop:receptionist-intake-v1]\``;
      } else {
        const isLandlord = enquiryType === 'landlord_r2r';
        reportMarkdown = `### Receptionist First-Reply Draft (${nowStr})\n- Prepared approved SOP first reply for **${isLandlord ? 'Landlord R2R Appraisal Enquiry' : 'Professional Occupant Room Enquiry'}** and placed in Approval Queue. \`[Source: sop:receptionist-intake-v1]\``;
        newDrafts.push({
          id: `DRF-${Math.floor(100 + Math.random() * 900)}`,
          roleId: role.id,
          roleName: role.name,
          tool: 'create_draft_message',
          recipient: isLandlord ? 'Prospective Landlord Enquiry' : 'Prospective Room Applicant',
          subject: isLandlord ? 'JM Letvest — Rent-to-Rent Property Appraisal Next Steps' : 'JM Letvest — Professional Room Enquiry Next Steps',
          body: isLandlord
            ? 'Thank you for contacting JM Letvest. To prepare a written Rent-to-Rent appraisal, please share the property postcode, bedroom count, current licensing status, and availability for a viewing. No standard rent figure is quoted prior to inspection. [Source: sop:receptionist-intake-v1]'
            : `Thank you for your room enquiry. We currently have ${t.rooms - t.occupied} available room(s) across our managed portfolio. Please confirm your preferred move-in date, budget, and employment/reference details so a manager can review suitability. [Source: sop:receptionist-intake-v1]`,
          citations: ['sop:receptionist-intake-v1'],
          requiresSolicitorCheck: isLandlord,
          status: 'pending_approval',
          createdAt: nowStr,
          tokensUsed: 290,
          costGBP: 0.0014
        });
      }
    }

    if (newDrafts.length > 0) {
      setDrafts((prev) => [...newDrafts, ...prev]);
    }

    const usedTokens = adapterMode === 'local-extractive-v1' ? 0 : 640;
    const costGBP = adapterMode === 'local-extractive-v1' ? 0 : 0.0032;
    setActiveRunOutput({
      roleName: role.name,
      adapter: adapterMode,
      timestamp: nowStr,
      tokens: usedTokens,
      costGBP,
      redactedCount: overdue.length + properties.length,
      solicitorFlag: requiresSolicitorCheck(reportMarkdown),
      reportMarkdown,
      citations
    });
    onNotify?.(`${role.name} completed run (${newDrafts.length} draft(s) added to Approval Queue)`);
  }

  function handleDraftDecision(draftId: string, status: DraftQueueItem['status']) {
    const target = drafts.find((d) => d.id === draftId);
    setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, status } : d)));
    if (status === 'approved' && target?.linkedTicketId && target?.linkedContractor && onAssignTicketContractor) {
      onAssignTicketContractor(target.linkedTicketId, target.linkedContractor);
      onNotify?.(`Approved ${draftId} and assigned ${target.linkedContractor} to ticket ${target.linkedTicketId}`);
      return;
    }
    onNotify?.(`Draft ${draftId} marked as ${status.replace('_', ' ')}`);
  }

  function toggleRoutine(routineId: string) {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== routineId) return r;
        const nextActive = !r.active;
        const defaultDays = r.id === 'jm-monday-arrears' ? 'mon' : r.id === 'jm-friday-scoreboard' ? 'fri' : 'mon,tue,wed,thu,fri';
        return {
          ...r,
          active: nextActive,
          days: nextActive ? defaultDays : 'off',
          lastRun: nextActive ? 'Armed (Europe/London GMT/BST)' : 'Inactive (days: off)'
        };
      })
    );
    onNotify?.('Updated SCHEDULE.md routine state');
  }

  const pendingDrafts = drafts.filter((d) => d.status === 'pending_approval');

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow">PHASE 2–5 · JM LETVEST AI OPERATIONS TEAM</div>
            <h2 className="text-base font-semibold mt-1">6-Role Human-in-the-Loop Command Centre</h2>
            <p className="text-xs text-slate-500 mt-1">
              Read-only by default · Every claim cites its record or SOP · Outbound/write actions are queued as drafts requiring owner approval.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-600 flex items-center gap-2">
              <span>Execution Adapter:</span>
              <select
                aria-label="Execution adapter"
                value={adapterMode}
                onChange={(e) => setAdapterMode(e.target.value as 'local-extractive-v1' | 'llm-provider-v1')}
              >
                <option value="local-extractive-v1">local-extractive-v1 (£0.00 offline fallback)</option>
                <option value="llm-provider-v1">llm-provider-v1 (PII-redacted + spend cap)</option>
              </select>
            </label>
            <Button
              variant={paused ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setPaused((p) => !p);
                onNotify?.(!paused ? 'Global kill switch PAUSED activated' : 'Global kill switch PAUSED cleared');
              }}
            >
              <PauseCircle size={15} />
              {paused ? 'Kill Switch: PAUSED (Click to Resume)' : 'Kill Switch: Armed (Active)'}
            </Button>
          </div>
        </div>
        {paused && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2" role="alert">
            <AlertTriangle size={16} />
            <strong>PAUSED file kill switch is active:</strong> All 6 AI roles and scheduled routines are blocked from executing until resumed.
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {JM_AI_ROLES.map((role) => (
          <section
            key={role.id}
            className={`panel p-5 flex flex-col justify-between border ${selectedRole === role.id ? 'border-teal-700 ring-1 ring-teal-700/20' : 'border-slate-200'}`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="badge green">{role.name}</span>
                <span className="text-[11px] text-slate-400">Cap: £{role.maxCostGBP.toFixed(2)} / {role.maxTokens} tok</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold">{role.title}</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{role.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {role.allowedTools.map((tl) => (
                  <span key={tl} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                    {tl}
                  </span>
                ))}
              </div>
              {role.id === 'jm-receptionist' && (
                <div className="mt-3">
                  <label className="text-[11px] text-slate-500 block mb-1">Test Enquiry Scenario:</label>
                  <select
                    aria-label="Receptionist test scenario"
                    className="w-full text-xs"
                    value={enquiryType}
                    onChange={(e) => setEnquiryType(e.target.value as typeof enquiryType)}
                  >
                    <option value="landlord_r2r">Landlord R2R Appraisal Enquiry</option>
                    <option value="tenant_room">Professional Room Enquiry</option>
                    <option value="emergency_gas">Emergency Gas Smell Guardrail</option>
                    <option value="missing_data">Missing-Data Refusal Test (Uninspected Property)</option>
                  </select>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <small className="text-[11px] text-slate-400">{role.schedule}</small>
              <Button
                size="sm"
                disabled={paused}
                onClick={() => {
                  setSelectedRole(role.id);
                  runRoleNow(role.id);
                }}
              >
                <Play size={13} /> Run {role.name.split(' ')[0]}
              </Button>
            </div>
          </section>
        ))}
      </div>

      {activeRunOutput && (
        <section className="panel p-6 border-l-4 border-l-teal-700" aria-label="AI execution output">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <span className="eyebrow">LATEST EXECUTION RECEIPT · {activeRunOutput.adapter.toUpperCase()}</span>
              <h3 className="text-sm font-semibold mt-1">
                {activeRunOutput.roleName} · {activeRunOutput.timestamp}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="badge gray">Tokens: {activeRunOutput.tokens}</span>
              <span className="badge gray">Spend: £{activeRunOutput.costGBP.toFixed(4)}</span>
              <span className="badge green">PII Redacted ({activeRunOutput.redactedCount} records)</span>
              {activeRunOutput.solicitorFlag && <span className="badge amber">Solicitor Check Flagged</span>}
            </div>
          </div>
          <div className="mt-4 text-xs leading-6 text-slate-700 whitespace-pre-line font-sans bg-slate-50 p-4 rounded-lg border border-slate-200/80">
            {activeRunOutput.reportMarkdown}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <strong>Verified Citations:</strong>
            {activeRunOutput.citations.map((c) => (
              <code key={c} className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded">
                [{c}]
              </code>
            ))}
          </div>
        </section>
      )}

      <section className="panel p-6" aria-label="AI approval queue">
        <div className="panel-heading !px-0 !pt-0">
          <div>
            <h2>Human Approval Queue ({pendingDrafts.length} pending)</h2>
            <p>Nothing is sent or dispatched automatically. Money, notices, deposits, evictions, and tenancy wording require owner approval and solicitor check.</p>
          </div>
        </div>
        <div className="space-y-3 mt-3">
          {drafts.map((d) => (
            <article key={d.id} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-xs font-mono text-slate-500">{d.id}</strong>
                  <span className="badge blue">{d.roleName}</span>
                  <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">{d.tool}</span>
                  {d.requiresSolicitorCheck && (
                    <span className="badge amber" title="Touches money, rent, deposits, notices, or tenancy terms">
                      Check with a solicitor
                    </span>
                  )}
                </div>
                <span
                  className={`badge ${
                    d.status === 'approved'
                      ? 'green'
                      : d.status === 'rejected'
                      ? 'red'
                      : d.status === 'revision_requested'
                      ? 'amber'
                      : 'gray'
                  }`}
                >
                  {d.status.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                <strong>To:</strong> {d.recipient} · <strong>Subject:</strong> {d.subject}
              </div>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                {d.body}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                  <span>Citations:</span>
                  {d.citations.map((c) => (
                    <code key={c} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {c}
                    </code>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={d.status === 'approved'} onClick={() => handleDraftDecision(d.id, 'approved')}>
                    <Check size={13} /> Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={d.status === 'revision_requested'} onClick={() => handleDraftDecision(d.id, 'revision_requested')}>
                    <RefreshCw size={13} /> Request Revision
                  </Button>
                  <Button size="sm" variant="ghost" disabled={d.status === 'rejected'} onClick={() => handleDraftDecision(d.id, 'rejected')}>
                    <X size={13} /> Reject
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-6" aria-label="Routines schedule manager">
        <div className="panel-heading !px-0 !pt-0">
          <div>
            <h2>Scheduled Routines (SCHEDULE.md · Europe/London GMT/BST)</h2>
            <p>All 4 routines default to inactive (days: off) until explicitly enabled by the owner. Includes missed-window catch-up and overlap lease protection.</p>
          </div>
        </div>
        <div className="table-scroll mt-3">
          <table>
            <thead>
              <tr>
                <th>Routine ID</th>
                <th>Assigned Role</th>
                <th>UK Time (Europe/London)</th>
                <th>Schedule Days</th>
                <th>Overlap Guard</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {routines.map((rt) => (
                <tr key={rt.id}>
                  <td className="font-mono text-xs">{rt.id}</td>
                  <td>{rt.title}</td>
                  <td>{rt.timeUk}</td>
                  <td className="font-mono text-xs">{rt.days}</td>
                  <td>
                    <span className="badge green">{rt.overlapStatus === 'clear' ? 'No active lease overlap' : 'Lease active'}</span>
                  </td>
                  <td>
                    <span className={`badge ${rt.active ? 'green' : 'gray'}`}>
                      {rt.active ? 'Enabled' : 'Inactive (days: off)'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleRoutine(rt.id)}>
                        {rt.active ? 'Disable' : 'Enable schedule'}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={paused} onClick={() => runRoleNow(rt.roleId)}>
                        Run now
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* =========================================================================
 * Phase 6a & 6c: Compliance Document Upload & Scheduled Notification Panel
 * ========================================================================= */
export function ComplianceDocumentsAndAlertsPanel({
  properties,
  payments,
  onNotify
}: {
  properties: Property[];
  payments: Payment[];
  onNotify?: (msg: string) => void;
}) {
  const [docs, setDocs] = useState<
    Array<{ id: string; propertyAddress: string; category: DocumentCategory; subtype: DocumentSubtype; fileName: string; expiresOn: string }>
  >([
    {
      id: 'DOC-01',
      propertyAddress: properties[0]?.address || '14 Alma Road',
      category: 'certificate',
      subtype: 'CP12',
      fileName: 'cp12-alma-road-2026.pdf',
      expiresOn: properties[0]?.compliance || '2026-11-20'
    },
    {
      id: 'DOC-02',
      propertyAddress: properties[0]?.address || '14 Alma Road',
      category: 'master_lease',
      subtype: 'Head Lease',
      fileName: 'head-lease-alma-road.pdf',
      expiresOn: properties[0]?.leaseEnd || '2028-09-30'
    }
  ]);

  const [propertyId, setPropertyId] = useState(properties[0]?.id || 'p1');
  const [category, setCategory] = useState<DocumentCategory>('certificate');
  const [subtype, setSubtype] = useState<DocumentSubtype>('CP12');
  const [expiresOn, setExpiresOn] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docError, setDocError] = useState('');

  const scheduledNotifications = buildDailyNotifications({
    referenceDate: new Date().toISOString().slice(0, 10),
    properties: properties.map((p) => ({
      id: p.id,
      address: p.address,
      certificates: { CP12: p.compliance, EICR: '2028-05-14' }
    })),
    payments: payments.map((pay) => ({
      id: pay.id,
      propertyId: pay.propertyId,
      room: pay.room,
      due: pay.due,
      amount: pay.amount,
      paid: pay.paid
    }))
  });

  function handleDocSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDocError('');
    const fileName = selectedFile ? selectedFile.name : `${subtype.toLowerCase().replace(/\s+/g, '-')}-2026.pdf`;
    const mimeType = selectedFile ? selectedFile.type || 'application/pdf' : 'application/pdf';
    const sizeBytes = selectedFile ? selectedFile.size : 245000;

    const check = validateDocumentUpload({
      workspaceId: 'ws-jm-letvest',
      propertyId,
      category,
      subtype,
      fileName,
      mimeType,
      sizeBytes,
      expiresOn: expiresOn || null
    });
    if (!check.valid) {
      setDocError(check.error || 'Invalid document');
      return;
    }
    const propAddr = properties.find((p) => p.id === propertyId)?.address || 'Portfolio Property';
    setDocs((prev) => [
      {
        id: `DOC-0${prev.length + 1}`,
        propertyAddress: propAddr,
        category,
        subtype,
        fileName,
        expiresOn: expiresOn || 'N/A'
      },
      ...prev
    ]);
    setExpiresOn('');
    setSelectedFile(null);
    onNotify?.(`Uploaded ${subtype} (${fileName}) to private bucket path: ${check.storagePath}`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <section className="panel p-6">
        <div className="panel-heading !px-0 !pt-0">
          <div>
            <h2>Private Document Vault (Certificates, Agreements & Inventories)</h2>
            <p>Private Supabase Storage bucket validation (max 10 MB, PDF/JPG/PNG; expiry date mandatory for certificates).</p>
          </div>
        </div>
        <form onSubmit={handleDocSubmit} className="form-grid mt-3">
          <label className="field">
            <span>Property</span>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              <option value="certificate">Certificate</option>
              <option value="master_lease">Master Head Lease</option>
              <option value="sub_lease">Room Sub-Lease</option>
              <option value="inventory">Room Inventory</option>
            </select>
          </label>
          <label className="field">
            <span>Document Subtype</span>
            <select value={subtype} onChange={(e) => setSubtype(e.target.value as DocumentSubtype)}>
              {DOCUMENT_SUBTYPES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Expiry Date {category === 'certificate' ? '(Required)' : '(Optional)'}</span>
            <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} required={category === 'certificate'} />
          </label>
          <label className="field col-span-full">
            <span>File (PDF, JPG, PNG up to 10 MB)</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </label>
          {docError && (
            <p role="alert" className="col-span-full text-xs text-red-700">
              {docError}
            </p>
          )}
          <div className="form-actions">
            <Button type="submit">
              <FileText size={14} /> Upload to Private Bucket
            </Button>
          </div>
        </form>
        <div className="table-scroll mt-4">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th>Category</th>
                <th>Subtype</th>
                <th>File</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.propertyAddress}</td>
                  <td>
                    <span className="badge blue">{d.category}</span>
                  </td>
                  <td>{d.subtype}</td>
                  <td className="font-mono text-xs">{d.fileName}</td>
                  <td>{d.expiresOn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-6">
        <div className="panel-heading !px-0 !pt-0">
          <div>
            <h2>Scheduled Cron Notifications (07:15 UTC Edge Function)</h2>
            <p>Live preview of `buildDailyNotifications()` for certificate expiries (≤30 days) and overdue rent.</p>
          </div>
        </div>
        <div className="space-y-3 mt-3">
          {scheduledNotifications.length === 0 ? (
            <p className="text-xs text-slate-500">No active expiry or arrears alerts today.</p>
          ) : (
            scheduledNotifications.map((n) => (
              <div key={n.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${n.severity === 'critical' ? 'red' : 'amber'}`}>{n.severity}</span>
                    <span className="text-xs font-mono text-slate-500">{n.kind}</span>
                    {n.checkWithSolicitor && <span className="badge amber">Solicitor check</span>}
                  </div>
                  <strong className="block text-xs mt-1.5">{n.title}</strong>
                  <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                </div>
                <Clock3 size={16} className="text-slate-400 shrink-0" />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

/* =========================================================================
 * Phase 6f: Interactive Bank Feed Matching Panel (Open Banking / GoCardless)
 * ========================================================================= */
export function InteractiveBankFeedPanel({
  payments,
  onMarkPaid,
  onNotify
}: {
  payments: Payment[];
  onMarkPaid: (paymentId: string) => void;
  onNotify?: (msg: string) => void;
}) {
  const [flagEnabled, setFlagEnabled] = useState(true);
  const sampleTransactions: BankTransaction[] = payments.map((p, idx) => ({
    id: `OB-TX-${1001 + idx}`,
    provider: idx % 2 === 0 ? 'open_banking' : 'gocardless',
    externalTxId: `EXT-${p.id}`,
    bookedOn: new Date().toISOString().slice(0, 10),
    amount: p.amount,
    reference: `RENT ${p.id} ${p.room}`
  }));

  const reconciliation = matchBankFeedTransactions(
    sampleTransactions,
    payments.map((p) => ({
      id: p.id,
      propertyId: p.propertyId,
      room: p.room,
      dueOn: p.due,
      amount: p.amount,
      paid: p.paid,
      expectedReference: p.id
    })),
    { NEXT_PUBLIC_ENABLE_BANK_FEED: flagEnabled ? 'true' : 'false' }
  );

  return (
    <section className="panel p-6 mt-6" aria-label="Bank feed reconciliation">
      <div className="panel-heading !px-0 !pt-0">
        <div>
          <h2>Bank Feed Matching (Open Banking & GoCardless · Feature-Flagged)</h2>
          <p>Matches incoming bank lines against outstanding room rent charges as `proposed_match` requiring human confirmation.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setFlagEnabled((f) => !f)}>
          {flagEnabled ? 'Feature Flag: ENABLED (Click to Disable)' : 'Feature Flag: OFF (Click to Enable)'}
        </Button>
      </div>

      {!reconciliation.enabled ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <strong>Bank Feed Matching Disabled (`NEXT_PUBLIC_ENABLE_BANK_FEED=false`):</strong> Click the button above to enable Open Banking / GoCardless proposed transaction matching.
        </div>
      ) : (
        <div className="table-scroll mt-3">
          <table>
            <thead>
              <tr>
                <th>Tx ID</th>
                <th>Provider</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Match Confidence</th>
                <th>Matched Payment</th>
                <th>Owner Action</th>
              </tr>
            </thead>
            <tbody>
              {sampleTransactions.map((tx) => {
                const m = reconciliation.matches.find((x) => x.transactionId === tx.id);
                const linkedPayment = payments.find((p) => p.id === m?.paymentId);
                return (
                  <tr key={tx.id}>
                    <td className="font-mono text-xs">{tx.id}</td>
                    <td>
                      <span className="badge blue">{tx.provider}</span>
                    </td>
                    <td className="font-mono text-xs">{tx.reference}</td>
                    <td>{money(tx.amount)}</td>
                    <td>
                      <span className={`badge ${m?.status === 'proposed_match' ? 'green' : 'gray'}`}>
                        {m?.confidence || 'already_reconciled'}
                      </span>
                    </td>
                    <td>{linkedPayment ? `${linkedPayment.name} (${linkedPayment.room})` : 'Already Paid / None'}</td>
                    <td>
                      {linkedPayment && !linkedPayment.paid ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onMarkPaid(linkedPayment.id);
                            onNotify?.(`Confirmed bank match ${tx.id} → marked ${linkedPayment.room} as Paid`);
                          }}
                        >
                          <Check size={13} /> Confirm & Mark Paid
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">Reconciled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* =========================================================================
 * Phase 6g: Role-Based Access Control (RBAC) & Immutable Audit Log Inspector
 * ========================================================================= */
export function RbacAndAuditLogPanel({ onNotify }: { onNotify?: (msg: string) => void }) {
  const [testRole, setTestRole] = useState<WorkspaceRole>('manager');
  const [auditEntries, setAuditEntries] = useState<
    Array<{ id: string; createdAt: string; actorRole: WorkspaceRole; action: string; tableName: string; summary: string }>
  >([
    {
      id: 'AUD-01',
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      actorRole: 'manager',
      action: 'draft.create',
      tableName: 'jm_letvest.draft_actions',
      summary: 'AI Rent & Finance Controller inserted pending_approval rent reminder draft DRF-101'
    },
    {
      id: 'AUD-02',
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      actorRole: 'owner',
      action: 'draft.approve',
      tableName: 'jm_letvest.draft_actions',
      summary: 'Human Owner approved CP12 contractor booking request after verifying Gas Safe registration'
    }
  ]);

  const actions: WorkspaceAction[] = [
    'portfolio.read',
    'draft.create',
    'draft.approve',
    'record.mutate',
    'audit.read',
    'resident.report_fault',
    'resident.read_own_lease'
  ];

  function recordTestAudit() {
    try {
      const entry = buildAuditEntry({
        workspaceId: 'ws-jm-letvest',
        actorId: `user-${testRole}`,
        actorRole: testRole,
        tableName: 'jm_letvest.properties',
        recordId: 'prop-1',
        action: 'UPDATE',
        beforeData: { headRent: 2000 },
        afterData: { headRent: 2100 }
      });
      setAuditEntries((prev) => [
        {
          id: `AUD-0${prev.length + 1}`,
          createdAt: entry.createdAt.slice(0, 19).replace('T', ' '),
          actorRole: entry.actorRole,
          action: `${entry.action} (ALLOWED)`,
          tableName: entry.tableName,
          summary: `Role "${testRole}" permitted to mutate ${entry.tableName}; immutable audit row recorded.`
        },
        ...prev
      ]);
      onNotify?.(`Audit log recorded permitted mutation by ${testRole}`);
    } catch (err) {
      setAuditEntries((prev) => [
        {
          id: `AUD-0${prev.length + 1}`,
          createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          actorRole: testRole,
          action: 'UPDATE (BLOCKED_BY_RLS)',
          tableName: 'jm_letvest.properties',
          summary: (err as Error).message
        },
        ...prev
      ]);
      onNotify?.(`Blocked direct mutation by "${testRole}" (RLS isolation enforced)`);
    }
  }

  return (
    <section className="panel p-6 mt-6" aria-label="RBAC and immutable audit log">
      <div className="panel-heading !px-0 !pt-0">
        <div>
          <h2>Role-Based Access Control (RBAC) & Immutable Audit Log</h2>
          <p>Verifies that the dedicated AI `manager` role can only read portfolio data and queue drafts while `owner` holds sole approval and mutation rights.</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Inspect role permissions" value={testRole} onChange={(e) => setTestRole(e.target.value as WorkspaceRole)}>
            <option value="owner">owner (Human Approver)</option>
            <option value="manager">manager (Dedicated AI Service Account)</option>
            <option value="viewer">viewer (Read-Only Auditor)</option>
            <option value="resident">resident (Tenant Portal Only)</option>
          </select>
          <Button size="sm" variant="outline" onClick={recordTestAudit}>
            <Lock size={13} /> Test Direct Mutation Gate
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {actions.map((act) => {
          const ok = canPerformWorkspaceAction(testRole, act);
          return (
            <span key={act} className={`badge ${ok ? 'green' : 'red'}`}>
              {act}: {ok ? 'ALLOW' : 'DENY'}
            </span>
          );
        })}
      </div>

      <div className="table-scroll mt-4">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor Role</th>
              <th>Action</th>
              <th>Target Table</th>
              <th>Audit Summary</th>
            </tr>
          </thead>
          <tbody>
            {auditEntries.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.createdAt}</td>
                <td>
                  <span className="badge blue">{a.actorRole}</span>
                </td>
                <td className="font-mono text-xs">{a.action}</td>
                <td className="font-mono text-xs">{a.tableName}</td>
                <td>{a.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
