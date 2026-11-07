import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK_DIR = join(ROOT_DIR, 'employees', 'jm-letvest');

export const JM_LETVEST_ROLE_FOLDERS = [
  'chief-of-staff',
  'compliance-officer',
  'rent-finance-controller',
  'maintenance-coordinator',
  'landlord-acquisition-scout',
  'receptionist'
];

export const SOLICITOR_CHECK_PATTERNS = [
  /\b(rent\s+arrears|arrears|overdue\s+rent|payment\s+demand|final\s+demand|late\s+payment)\b/i,
  /\b(section\s*8|section\s*21|notice\s+to\s+quit|possession\s+notice|legal\s+notice|evict|eviction|bailiff|court\s+order)\b/i,
  /\b(deposit|dps|tds|mydeposits|prescribed\s+information|deposit\s+deduction|holding\s+deposit)\b/i,
  /\b(tenancy\s+agreement|ast|assured\s+shorthold|licence\s+to\s+occupy|head\s+lease|master\s+lease|break\s+clause|surrender|guarantor|guaranteed\s+rent\s+offer|heads\s+of\s+terms)\b/i,
  /£\s*\d+|\b(gbp|sterling|deduction|recharge|landlord\s+statement|monthly\s+statement)\b/i
];

export function requiresSolicitorCheck(textOrPayload, roleManifest = null) {
  if (roleManifest?.governance?.alwaysRequireSolicitorCheck) {
    return true;
  }
  const serialized = typeof textOrPayload === 'string'
    ? textOrPayload
    : JSON.stringify(textOrPayload || {});
  return SOLICITOR_CHECK_PATTERNS.some(pattern => pattern.test(serialized));
}

export function isGlobalKillSwitchActive(customRoot = ROOT_DIR) {
  return (
    existsSync(join(customRoot, 'PAUSED')) ||
    existsSync(join(customRoot, 'employees', 'jm-letvest', 'PAUSED'))
  );
}

export function loadJmLetvestRoleManifest(folderName) {
  if (!JM_LETVEST_ROLE_FOLDERS.includes(folderName)) {
    throw new Error(`Unsupported JM Letvest role folder: ${folderName}`);
  }
  const roleDir = join(PACK_DIR, folderName);
  const manifestPath = join(roleDir, 'employee.json');
  const roleMdPath = join(roleDir, 'ROLE.md');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const roleMarkdown = readFileSync(roleMdPath, 'utf8');

  if (manifest.schema !== 'ai-employee/1') {
    throw new Error(`Invalid schema in ${manifestPath}: expected ai-employee/1`);
  }
  if (!manifest.governance?.readOnlyByDefault || !manifest.governance?.outboundRequiresApproval) {
    throw new Error(`Role ${folderName} must enforce readOnlyByDefault and outboundRequiresApproval`);
  }
  if (!manifest.limits?.maxTokensPerRun || typeof manifest.limits?.maxDailySpendGbp !== 'number') {
    throw new Error(`Role ${folderName} must define maxTokensPerRun and maxDailySpendGbp`);
  }

  return {
    folder: folderName,
    roleDir,
    manifest,
    roleMarkdown
  };
}

export function loadAllJmLetvestRoles() {
  return JM_LETVEST_ROLE_FOLDERS.map(loadJmLetvestRoleManifest);
}

export function loadApprovedJmLetvestSops() {
  const sopPath = join(PACK_DIR, 'sops', 'approved-sops.md');
  return readFileSync(sopPath, 'utf8');
}
