const STAFF_ROLES = [
  'SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_MANAGER', 'QUESTION_MODERATOR',
  'PROCTOR', 'EVALUATOR', 'AUDITOR',
];

export function normalizeRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((role) => (typeof role === 'string' ? role : (role as { name?: string })?.name))
    .filter((role): role is string => typeof role === 'string' && role.length > 0);
}

/** Staff portal access — must have an explicit staff role. */
export function isAdmin(roles: unknown) {
  const normalized = normalizeRoles(roles);
  return normalized.some((role) => STAFF_ROLES.includes(role));
}

/** Pure candidate — has CANDIDATE role and no staff roles. */
export function isCandidate(roles: unknown) {
  const normalized = normalizeRoles(roles);
  return normalized.includes('CANDIDATE') && !isAdmin(normalized);
}

export function isStaff(roles: unknown) {
  return isAdmin(roles);
}
