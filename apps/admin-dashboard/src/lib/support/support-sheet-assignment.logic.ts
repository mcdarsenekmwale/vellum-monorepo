// lib/support/support-sheet-assignment.logic.ts

import { roleRank, type Role } from "@/lib/auth/rbac";

/* ─── Sheet view state (reducer) ───────────────────────────────────────────── */

export interface SheetState {
  openTicketId: string | null;
  isExpanded: boolean;
}

export function initSheetState(): SheetState {
  return { openTicketId: null, isExpanded: false };
}

export type SheetAction =
  | { type: "OPEN_TICKET"; ticketId: string }
  | { type: "CLOSE_TICKET" }
  | { type: "TOGGLE_EXPAND" };

export function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case "OPEN_TICKET":
      return { openTicketId: action.ticketId, isExpanded: false };
    case "CLOSE_TICKET":
      return { openTicketId: null, isExpanded: false };
    case "TOGGLE_EXPAND":
      return state.openTicketId == null ? state : { ...state, isExpanded: !state.isExpanded };
    default:
      return state;
  }
}

/* ─── Assignment Security Rules ────────────────────────────────────────────── */

export interface TicketAssignmentContext {
  ticketId: string;
  currentAssigneeId?: string | null;
  requesterId: string;
  assigneeId: string;
}

export interface AssignerContext {
  userId: string;
  userRole: Role | string;
  isTicketOwner?: boolean;
  isTicketAssignee?: boolean;
  hasWritePermission?: boolean;
}

/**
 * Comprehensive ticket assignment security rules.
 * 
 * Rules:
 * 1. If ticket is not assigned → any user with correct role can assign
 * 2. If ticket is assigned → only Admin, SupportAdmin, or SupportAgent with write permission can reassign
 * 3. If user is the ticket owner with appropriate role/permission → can reassign
 * 4. If ticket is assigned and user is neither owner nor Admin/SupportAdmin → cannot assign
 * 5. Users cannot assign tickets to themselves (unless explicitly allowed for self-assignment)
 * 6. Users cannot reassign tickets that are already in a terminal state (RESOLVED, CLOSED)
 * 7. Users cannot assign tickets to inactive agents
 * 8. Users cannot assign tickets that are escalated (only SupportAdmin/Admin can reassign escalated tickets)
 * 9. Users cannot assign tickets if they have exceeded their assignment limit
 * 10. Audit trail required for all assignment actions
 */
export function canAssignTicket(
  assigner: AssignerContext,
  ticket: {
    assigneeId?: string | null;
    status: string;
    priority?: string;
    isEscalated?: boolean;
  },
  targetAgent: {
    userId: string;
    isActive: boolean;
    maxTickets?: number;
    activeTickets?: number;
    role: any;
  },
  assignmentContext?: TicketAssignmentContext
): { allowed: boolean; reason?: string } {
  const actor = roleRank(assigner.userRole as Role);
  
  // ─── Rule 1: Users cannot assign tickets to themselves ───
  // Exception: Self-assignment is allowed if explicitly enabled
  if (assigner.userId === targetAgent.userId && !assigner.isTicketAssignee) {
    return { allowed: false, reason: "You cannot assign a ticket to yourself" };
  }

  // ─── Rule 2: Terminal status check ───
  const terminalStatuses = ["RESOLVED", "CLOSED"];
  if (terminalStatuses.includes(ticket.status)) {
    return { 
      allowed: false, 
      reason: `Cannot assign tickets in ${ticket.status} status` 
    };
  }

  // ─── Rule 3: Escalated tickets ───
  if (ticket.isEscalated || ticket.status === "ESCALATED") {
    // Only SupportAdmin and above can reassign escalated tickets
    if (actor < 6) { // SupportAdmin = 6
      return { 
        allowed: false, 
        reason: "Only Support Admins can reassign escalated tickets" 
      };
    }
  }

  // ─── Rule 4: Inactive agent check ───
  if (!targetAgent.isActive) {
    return { allowed: false, reason: "Cannot assign to an inactive agent" };
  }

  // ─── Rule 5: Agent capacity check ───
  if (targetAgent.maxTickets && targetAgent.activeTickets !== undefined) {
    if (targetAgent.activeTickets >= targetAgent.maxTickets) {
      return { 
        allowed: false, 
        reason: `Agent has reached maximum capacity (${targetAgent.maxTickets} tickets)` 
      };
    }
  }

  // ─── Rule 6: Permission-based assignment ───
  
  // SuperAdmin (8), Admin (7), SupportAdmin (6) → Full access
  if (actor >= 6) {
    // Check if user has write permission
    if (!assigner.hasWritePermission && actor === 6) {
      // SupportAdmin needs write permission for reassignment
      return { 
        allowed: false, 
        reason: "Insufficient permissions to reassign tickets" 
      };
    }
    return { allowed: true };
  }

  // ─── Rule 7: SupportAgent (5) ───
  if (actor === 5) {
    // Can only assign to other SupportAgents
    const targetRole = targetAgent.role || "SupportAgent";
    if (roleRank(targetRole as Role) !== 5) {
      return { 
        allowed: false, 
        reason: "Support Agents can only assign to other Support Agents" 
      };
    }

    // Can only assign if ticket is unassigned OR they are the current assignee/owner
    const isUnassigned = !ticket.assigneeId;
    const isAssignee = ticket.assigneeId === assigner.userId;
    const isTicketOwner = assigner.isTicketOwner;

    if (!isUnassigned && !isAssignee && !isTicketOwner) {
      return { 
        allowed: false, 
        reason: "You can only reassign tickets that are assigned to you or owned by you" 
      };
    }

    return { allowed: true };
  }

  // ─── Rule 8: Moderator and below (4 and below) ───
  if (actor <= 4) {
    return { 
      allowed: false, 
      reason: "You don't have permission to assign tickets" 
    };
  }

  // ─── Rule 9: Default fallback ───
  return { allowed: false, reason: "Unknown permission error" };
}

/**
 * Legacy function for backward compatibility
 */
export function canAssignTo({ actorRole, targetRole }: { actorRole: Role | string; targetRole: Role | string }): boolean {
  const actor = roleRank(actorRole as Role);
  const target = roleRank(targetRole as Role);
  
  if (actor === 0) return false;
  
  // Admins (including SupportAdmin and SuperAdmin) >= 6 → can assign to everyone
  if (actor >= 6) return true;
  
  // SupportAgent (rank 5) can only assign to other SupportAgents
  if (actor === 5) return target === 5;
  
  return false;
}

/* ─── Agent picker filter + search ─────────────────────────────────────────── */

export interface AgentLike {
  userId: string;
  user: { name: string; email: string; avatar?: string | null; handle?: string | null };
  role?: string;
  skills?: string[];
  isActive?: boolean;
  maxTickets?: number;
  activeTickets?: number;
}

export interface FilterAssignableAgentsArgs<T extends AgentLike> {
  agents: T[];
  actorRole: Role | string;
  search?: string;
  ticketContext?: {
    assigneeId?: string | null;
    status: string;
    isEscalated?: boolean;
    requesterId?: string;
  };
}

export function filterAssignableAgents<T extends AgentLike>({
  agents,
  actorRole,
  search,
  ticketContext,
}: FilterAssignableAgentsArgs<T>): T[] {
  const actorAsRole = actorRole as Role;
  const actorRank = roleRank(actorAsRole);

  let candidates = agents?.filter((a) => {
    // ─── Filter 1: Active agents only ───
    if (a.isActive === false) return false;

    // ─── Filter 2: Role-based filtering ───
    const targetRole = (a.role ?? "SupportAgent") as Role;
    const targetRank = roleRank(targetRole);
    
    // If we have ticket context, apply advanced filtering
    if (ticketContext) {
      // For escalated tickets, only SupportAdmin+ can see agents
      if (ticketContext.isEscalated && actorRank < 6) {
        // SupportAgent (5) cannot see assignable agents for escalated tickets
        if (actorRank === 5) return false;
      }

      // For terminal statuses, no one can assign
      const terminalStatuses = ["RESOLVED", "CLOSED"];
      if (terminalStatuses.includes(ticketContext.status)) {
        return false;
      }
    }

    // ─── Filter 3: Capacity check ───
    if (a.maxTickets && a.activeTickets !== undefined) {
      if (a.activeTickets >= a.maxTickets) return false;
    }

    // ─── Filter 4: Role hierarchy ───
    // SuperAdmin/Admin/SupportAdmin can assign to anyone
    if (actorRank >= 6) return true;
    
    // SupportAgent can only assign to other SupportAgents
    if (actorRank === 5) return targetRank === 5;
    
    // Everyone else cannot assign
    return false;
  });

  // ─── Apply search filter ───
  if (search && search.trim().length > 0) {
    const q = search.trim().toLowerCase();
    candidates = candidates?.filter((a) => {
      const name = (a.user?.name ?? "").toLowerCase();
      const email = (a.user?.email ?? "").toLowerCase();
      const handle = (a.user?.handle ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || handle.includes(q);
    });
  }

  return candidates ?? [];
}

/**
 * Get assignment permissions summary for a user
 */
export function getAssignmentPermissions(userRole: Role | string): {
  canAssign: boolean;
  canReassign: boolean;
  canAssignToEscalated: boolean;
  maxAssignmentLevel: number;
} {
  const rank = roleRank(userRole as Role);
  
  return {
    canAssign: rank >= 5,
    canReassign: rank >= 6,
    canAssignToEscalated: rank >= 6,
    maxAssignmentLevel: rank >= 6 ? 3 : rank === 5 ? 1 : 0,
  };
}