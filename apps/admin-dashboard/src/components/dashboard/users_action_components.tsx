import { useState, useCallback, useMemo } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  AlertCircle,
  Wand2,
  Eye,
  EyeOff,
  X,
  Shield,
  User,
  AtSign,
  Mail,
  KeyRound,
  Users,
  CheckCircle2,
  Copy,
  Sparkles,
  UserPlus,
  Lock,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  AlertTriangle,
  AlignLeft,
  FileText,
  RefreshCw,
  Send,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─── Password Generator ─── */

function generatePassword(length = 16): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = upper + lower + numbers + symbols;

  let password = "";
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (!password) return { label: "", color: "", width: "0%" };
  const score = password.length;
  if (score >= 16) return { label: "Strong", color: "bg-emerald-500", width: "100%" };
  if (score >= 12) return { label: "Good", color: "bg-blue-500", width: "75%" };
  if (score >= 8) return { label: "Fair", color: "bg-amber-500", width: "50%" };
  return { label: "Weak", color: "bg-rose-500", width: "25%" };
}

/* ─── Role Badge ─── */

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { icon: any; color: string; label: string }> = {
    ADMIN: { icon: ShieldAlert, color: "bg-rose-500/10 text-rose-500 border-rose-500/20", label: "Admin" },
    MODERATOR: { icon: Shield, color: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "Moderator" },
    EDITOR: { icon: UserCog, color: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Editor" },
    CREATOR: { icon: Sparkles, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", label: "Creator" },
    DEVELOPER: { icon: ShieldCheck, color: "bg-purple-500/10 text-purple-500 border-purple-500/20", label: "Developer" },
    USER: { icon: User, color: "bg-muted text-muted-foreground border-muted", label: "User" },
  };

  const { icon: Icon, color, label } = config[role] || config.USER;

  return (
    <Badge variant="outline" className={cn("gap-1 px-2 py-0.5 text-xs font-medium", color)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

/* ─── Create User Sheet ─── */

function CreateUserSheet({
  open,
  onOpenChange,
  createEmail,
  setCreateEmail,
  createName,
  setCreateName,
  createHandle,
  setCreateHandle,
  createRole,
  setCreateRole,
  createPassword,
  setCreatePassword,
  handleCreate,
  createUserPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  createEmail: string;
  setCreateEmail: (v: string) => void;
  createName: string;
  setCreateName: (v: string) => void;
  createHandle: string;
  setCreateHandle: (v: string) => void;
  createRole: string;
  setCreateRole: (v: string) => void;
  createPassword: string;
  setCreatePassword: (v: string) => void;
  handleCreate: () => void;
  createUserPending: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleGenerate = useCallback(() => {
    const pwd = generatePassword();
    setCreatePassword(pwd);
    setCopied(false);
  }, [setCreatePassword]);

  const handleCopy = useCallback(() => {
    if (createPassword) {
      navigator.clipboard.writeText(createPassword);
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [createPassword]);

  const strength = getPasswordStrength(createPassword);

  const isValid =
    createEmail.trim() &&
    createName.trim() &&
    createHandle.trim() &&
    createPassword.trim();

  const handleFieldBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md border-l bg-background p-0 overflow-y-auto">
        <SheetHeader className="border-b px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <UserPlus className="size-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold">Invite user</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Create a new user account with role and credentials
                </SheetDescription>
              </div>
            </div>
            
          </div>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="create-email" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Mail className="size-3.5" />
              Email *
            </Label>
            <Input
              id="create-email"
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              onBlur={() => handleFieldBlur("email")}
              placeholder="user@example.com"
              autoFocus
              className={cn(
                "focus-visible:ring-offset-0",
                touched.email && !createEmail && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
            {touched.email && !createEmail && (
              <p className="text-xs text-rose-500">Email is required</p>
            )}
          </div>

          <Separator />

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="create-name" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <User className="size-3.5" />
              Full Name *
            </Label>
            <Input
              id="create-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onBlur={() => handleFieldBlur("name")}
              placeholder="John Doe"
              className={cn(
                "focus-visible:ring-offset-0",
                touched.name && !createName && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
            {touched.name && !createName && (
              <p className="text-xs text-rose-500">Name is required</p>
            )}
          </div>

          {/* Handle */}
          <div className="space-y-2">
            <Label htmlFor="create-handle" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <AtSign className="size-3.5" />
              Handle *
            </Label>
            <Input
              id="create-handle"
              value={createHandle}
              onChange={(e) => setCreateHandle(e.target.value.toLowerCase().replace(/\s/g, ""))}
              onBlur={() => handleFieldBlur("handle")}
              placeholder="johndoe"
              className={cn(
                "focus-visible:ring-offset-0 font-mono",
                touched.handle && !createHandle && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
            {touched.handle && !createHandle && (
              <p className="text-xs text-rose-500">Handle is required</p>
            )}
            {createHandle && (
              <p className="text-xs text-muted-foreground font-mono">@{createHandle}</p>
            )}
          </div>

          <Separator />

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="create-role" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Shield className="size-3.5" />
              Role
            </Label>
            <Select value={createRole} onValueChange={setCreateRole}>
              <SelectTrigger id="create-role" className="focus-visible:ring-offset-0">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GUEST">Guest</SelectItem>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="EDITOR">Editor</SelectItem>
                <SelectItem value="MODERATOR">Moderator</SelectItem>
                <SelectItem value="CREATOR">Creator</SelectItem>
                <SelectItem value="DEVELOPER">Developer</SelectItem>
                <SelectItem value="SUPPORT_AGENT">Support Agent</SelectItem>
                <SelectItem value="SUPPORT_ADMIN">Support Admin</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-1">
              <RoleBadge role={createRole} />
            </div>
          </div>

          <Separator />

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="create-password" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <KeyRound className="size-3.5" />
              Password *
            </Label>
            <div className="relative">
              <Input
                id="create-password"
                type={showPassword ? "text" : "password"}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                onBlur={() => handleFieldBlur("password")}
                placeholder="Enter a strong password"
                className={cn(
                  "pr-28 font-mono focus-visible:ring-offset-0",
                  touched.password && !createPassword && "border-rose-500 focus-visible:ring-rose-500"
                )}
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="h-8 w-8"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {showPassword ? "Hide password" : "Show password"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            {touched.password && !createPassword && (
              <p className="text-xs text-rose-500">Password is required</p>
            )}

            {/* Password Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                className="gap-1.5 text-xs"
              >
                <Wand2 className="size-3.5" />
                Generate
              </Button>
              {createPassword && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="gap-1.5 text-xs"
                  >
                    {copied ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(true)}
                    className="text-xs"
                  >
                    <Eye className="size-3.5" />
                    Show
                  </Button>
                </>
              )}
            </div>

            {/* Password Strength */}
            {createPassword && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Strength</span>
                  <span className={cn("text-xs font-medium", strength.color.replace("bg-", "text-"))}>
                    {strength.label}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", strength.color)}
                    style={{ width: strength.width }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createUserPending || !isValid}>
            {createUserPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create user"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Edit User Dialog ─── */

function EditUserDialog({
  open,
  onOpenChange,
  editEmail,
  setEditEmail,
  editName,
  setEditName,
  editHandle,
  setEditHandle,
  editRole,
  setEditRole,
  handleEdit,
  updateUserPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  editName: string;
  setEditName: (v: string) => void;
  editHandle: string;
  setEditHandle: (v: string) => void;
  editRole: string;
  setEditRole: (v: string) => void;
  handleEdit: () => void;
  updateUserPending: boolean;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const isValid = editEmail.trim() && editName.trim() && editHandle.trim();

  const handleFieldBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <UserCog className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Edit user</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update user details and role
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="edit-email" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Mail className="size-3.5" />
              Email *
            </Label>
            <Input
              id="edit-email"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              onBlur={() => handleFieldBlur("email")}
              className={cn(
                "focus-visible:ring-offset-0",
                touched.email && !editEmail && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
            {touched.email && !editEmail && (
              <p className="text-xs text-rose-500">Email is required</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-name" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <User className="size-3.5" />
              Full Name *
            </Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleFieldBlur("name")}
              className={cn(
                "focus-visible:ring-offset-0",
                touched.name && !editName && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
            {touched.name && !editName && (
              <p className="text-xs text-rose-500">Name is required</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-handle" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <AtSign className="size-3.5" />
              Handle *
            </Label>
            <Input
              id="edit-handle"
              value={editHandle}
              onChange={(e) => setEditHandle(e.target.value.toLowerCase().replace(/\s/g, ""))}
              onBlur={() => handleFieldBlur("handle")}
              className={cn(
                "font-mono focus-visible:ring-offset-0",
                touched.handle && !editHandle && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
            {touched.handle && !editHandle && (
              <p className="text-xs text-rose-500">Handle is required</p>
            )}
            {editHandle && (
              <p className="text-xs text-muted-foreground font-mono">@{editHandle}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Shield className="size-3.5" />
              Role
            </Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger id="edit-role" className="focus-visible:ring-offset-0">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="EDITOR">Editor</SelectItem>
                <SelectItem value="MODERATOR">Moderator</SelectItem>
                <SelectItem value="CREATOR">Creator</SelectItem>
                <SelectItem value="DEVELOPER">Developer</SelectItem>
                <SelectItem value="SUPPORT_AGENT">Support Agent</SelectItem>
                <SelectItem value="SUPPORT_ADMIN">Support Admin</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-1">
              <RoleBadge role={editRole} />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleEdit} disabled={updateUserPending || !isValid}>
            {updateUserPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Delete Confirmation Dialog ─── */

function DeleteUserDialog({
  open,
  onOpenChange,
  selectedUser,
  currentUser,
  handleDelete,
  deleteUserPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedUser: { id: string; name: string } | null;
  currentUser: { id: string } | null;
  handleDelete: () => void;
  deleteUserPending: boolean;
}) {
  const isSelfDelete = selectedUser?.id === currentUser?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-500/10">
            <AlertCircle className="size-6 text-rose-500" />
          </div>
          <DialogTitle className="text-lg font-semibold">Delete user</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{selectedUser?.name}</strong>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {isSelfDelete && (
          <div className="mx-6 my-2 flex items-start gap-3 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
            <p className="text-sm text-rose-600 dark:text-rose-400">
              You are about to delete your own account. You will be logged out
              immediately.
            </p>
          </div>
        )}

        <DialogFooter className="px-6 py-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteUserPending}
          >
            {deleteUserPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete user"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Bulk Delete Dialog ─── */

function BulkDeleteDialog({
  open,
  onOpenChange,
  selectedIds,
  handleBulkDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedIds: string[];
  handleBulkDelete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-500/10">
            <Users className="size-6 text-rose-500" />
          </div>
          <DialogTitle className="text-lg font-semibold">Delete selected users</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{selectedIds.length}</strong> users?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {selectedIds.length > 5 && (
          <div className="mx-6 my-2 flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-600 dark:text-amber-400">
              You are about to delete {selectedIds.length} users. This is a destructive
              action and cannot be reversed.
            </p>
          </div>
        )}

        <DialogFooter className="px-6 py-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleBulkDelete}>
            Delete {selectedIds.length} users
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ─── Types ─── */

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  tags: string[];
  category: 'welcome' | 'notification' | 'marketing' | 'support' | 'system';
  icon: React.ComponentType<{ className?: string }>;
}

interface EmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; name: string; email: string } | null;
  onSend: (subject: string, body: string) => Promise<void>;
}

/* ─── Email Templates ─── */

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome",
    name: "Welcome Email",
    description: "Welcome new users to the platform",
    subject: "Welcome to {{workspace_name}}, {{user_name}}!",
    body: `Hi {{user_name}},

Welcome to {{workspace_name}}! We're thrilled to have you on board.

Here are a few things you can do to get started:
1. Complete your profile
2. Explore the platform
3. Connect with other members

If you have any questions, feel free to reach out to our support team.

Best regards,
The {{workspace_name}} Team`,
    tags: ["onboarding", "welcome"],
    category: "welcome",
    icon: Sparkles,
  },
  {
    id: "account_activation",
    name: "Account Activation",
    description: "Send account activation link",
    subject: "Activate your {{workspace_name}} account",
    body: `Hi {{user_name}},

Thank you for creating an account with {{workspace_name}}. To complete your registration, please click the link below to activate your account:

[Activate Account]({{activation_link}})

This link will expire in 24 hours.

If you didn't create this account, you can safely ignore this email.

Thanks,
The {{workspace_name}} Team`,
    tags: ["activation", "security"],
    category: "welcome",
    icon: FileText,
  },
  {
    id: "password_reset",
    name: "Password Reset",
    description: "Send password reset instructions",
    subject: "Reset your {{workspace_name}} password",
    body: `Hi {{user_name}},

We received a request to reset your password for your {{workspace_name}} account.

Click the link below to create a new password:

[Reset Password]({{reset_link}})

If you didn't request this, please ignore this email or contact support.

Stay secure,
The {{workspace_name}} Team`,
    tags: ["security", "password"],
    category: "support",
    icon: RefreshCw,
  },
  {
    id: "account_suspended",
    name: "Account Suspended",
    description: "Notify user of account suspension",
    subject: "Your {{workspace_name}} account has been suspended",
    body: `Hi {{user_name}},

We're writing to inform you that your {{workspace_name}} account has been temporarily suspended due to a violation of our terms of service.

Reason: {{suspension_reason}}

If you believe this is a mistake, please contact our support team at {{support_email}}.

Regards,
The {{workspace_name}} Moderation Team`,
    tags: ["security", "moderation"],
    category: "system",
    icon: AlertTriangle,
  },
  {
    id: "feedback_request",
    name: "Feedback Request",
    description: "Request user feedback",
    subject: "We'd love to hear from you, {{user_name}}!",
    body: `Hi {{user_name}},

We hope you're enjoying your experience with {{workspace_name}}.

We'd love to hear your thoughts and feedback. Your input helps us improve the platform for everyone.

Please take a moment to complete our short feedback survey:

[Share Feedback]({{feedback_link}})

Thank you for being a valued member of our community!

Best,
The {{workspace_name}} Team`,
    tags: ["feedback", "survey"],
    category: "marketing",
    icon: Users,
  },
  {
    id: "feature_announcement",
    name: "Feature Announcement",
    description: "Announce new features",
    subject: "New feature: {{feature_name}} is now available!",
    body: `Hi {{user_name}},

We're excited to announce the release of {{feature_name}} on {{workspace_name}}!

What's new:
{{feature_details}}

We can't wait to see what you create with this new feature.

Try it out today!

Cheers,
The {{workspace_name}} Team`,
    tags: ["announcement", "product"],
    category: "marketing",
    icon: Sparkles,
  },
  {
    id: "welcome_back",
    name: "Welcome Back",
    description: "Re-engage inactive users",
    subject: "We miss you, {{user_name}}!",
    body: `Hi {{user_name}},

It's been a while since we've seen you on {{workspace_name}}. We've made some exciting updates and improvements, and we'd love for you to check them out.

Here's what's new:
- {{recent_updates}}

Come back and see what you've been missing!

See you soon,
The {{workspace_name}} Team`,
    tags: ["re-engagement", "inactive"],
    category: "marketing",
    icon: RefreshCw,
  },
  {
    id: "invoice_reminder",
    name: "Invoice Reminder",
    description: "Send invoice reminder",
    subject: "Payment reminder: Invoice #{{invoice_number}}",
    body: `Hi {{user_name}},

This is a reminder that payment for invoice #{{invoice_number}} is due on {{due_date}}.

Invoice details:
- Amount: {{invoice_amount}}
- Due Date: {{due_date}}
- Status: {{invoice_status}}

You can view and pay your invoice here: {{invoice_link}}

Thank you for your prompt attention to this matter.

Best,
The {{workspace_name}} Billing Team`,
    tags: ["billing", "payment"],
    category: "system",
    icon: AlertTriangle,
  },
  {
    id: "welcome_team",
    name: "Welcome to the Team",
    description: "Welcome new team members",
    subject: "Welcome to the team, {{user_name}}!",
    body: `Hi {{user_name}},

Welcome to the {{workspace_name}} team! We're excited to have you join us.

Here's what you need to know to get started:
- Your role: {{user_role}}
- Your manager: {{manager_name}}
- Team channels: {{team_channels}}

Feel free to reach out if you have any questions.

Welcome aboard!

Best,
The {{workspace_name}} Team`,
    tags: ["onboarding", "team"],
    category: "welcome",
    icon: Users,
  },
];

/* ─── Main Component ─── */

function EmailDialog({
  open,
  onOpenChange,
  user,
  onSend,
}: EmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"compose" | "templates">("compose");

  // Template variables
  const variables = useMemo(() => ({
    user_name: user?.name || "User",
    user_email: user?.email || "user@example.com",
    workspace_name: "Vellum",
    support_email: "support@vellum.com",
    activation_link: "https://app.vellum.com/activate/{{token}}",
    reset_link: "https://app.vellum.com/reset/{{token}}",
    feedback_link: "https://app.vellum.com/feedback",
    feature_name: "AI Content Generator",
    feature_details: "Create content 10x faster with AI assistance",
    recent_updates: "New AI features, improved performance, and better UX",
    invoice_number: "INV-2024-001",
    invoice_amount: "$299.00",
    due_date: "December 15, 2024",
    invoice_status: "Due",
    invoice_link: "https://app.vellum.com/billing/invoices/INV-2024-001",
    user_role: "Editor",
    manager_name: "Sarah Chen",
    team_channels: "#general, #content, #product",
    suspension_reason: "Violation of content policies",
  }), [user]);

  // Apply template
  const applyTemplate = useCallback((templateId: string) => {
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    let templateSubject = template.subject;
    let templateBody = template.body;

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      templateSubject = templateSubject.replace(new RegExp(`{{${key}}}`, 'g'), value);
      templateBody = templateBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    setSubject(templateSubject);
    setBody(templateBody);
    setSelectedTemplate(templateId);
    setActiveTab("compose");
  }, [variables]);

  // Reset form
  const resetForm = useCallback(() => {
    setSubject("");
    setBody("");
    setSelectedTemplate("");
    setPreviewMode(false);
  }, []);

  // Handle send
  const handleSend = useCallback(async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Please fill in both subject and body");
      return;
    }

    setIsSending(true);
    try {
      await onSend(subject, body);
      toast.success(`Email sent to ${user?.name}`);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  }, [subject, body, user, onSend, resetForm, onOpenChange]);

  // Get category label
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      welcome: "Welcome",
      notification: "Notification",
      marketing: "Marketing",
      support: "Support",
      system: "System",
    };
    return labels[category] || category;
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      welcome: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      notification: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      marketing: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      support: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      system: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    };
    return colors[category] || colors.notification;
  };

  // Filter templates by category
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const filteredTemplates = useMemo(() => {
    if (filterCategory === "all") return EMAIL_TEMPLATES;
    return EMAIL_TEMPLATES.filter(t => t.category === filterCategory);
  }, [filterCategory]);

  const categories = useMemo(() => {
    const cats = new Set(EMAIL_TEMPLATES.map(t => t.category));
    return ["all", ...Array.from(cats)];
  }, []);

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Mail className="size-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  Send Email
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {user ? `To: ${user.name} <${user.email}>` : "Compose an email"}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <AtSign className="size-3" />
                {user?.email || "No recipient"}
              </Badge>
              
            </div>
          </div>
        </DialogHeader>

        <div className="flex h-[calc(90vh-140px)]">
          {/* Sidebar */}
          <div className="w-[240px] border-r bg-muted/20 overflow-y-auto p-4 hidden md:block">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Templates
                </h4>
                <div className="space-y-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                        filterCategory === cat
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      {cat === "all" ? "All Templates" : getCategoryLabel(cat)}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Quick Actions
                </h4>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setSubject("");
                      setBody("");
                      setActiveTab("compose");
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
                  >
                    <AlignLeft className="size-3.5 inline mr-2" />
                    New Email
                  </button>
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
                  >
                    {previewMode ? (
                      <>
                        <EyeOff className="size-3.5 inline mr-2" />
                        Edit Mode
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5 inline mr-2" />
                        Preview Mode
                      </>
                    )}
                  </button>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Variables
                </h4>
                <div className="space-y-1">
                  {Object.keys(variables).map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/50 text-xs"
                    >
                      <code className="font-mono text-[10px]">{`{{${key}}}`}</code>
                      <span className="text-muted-foreground text-[9px]">
                        {variables[key as keyof typeof variables]?.toString().slice(0, 20)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "compose" | "templates")} className="flex-1 flex flex-col">
              <div className="border-b px-6 py-2">
                <TabsList>
                  <TabsTrigger value="compose" className="gap-2">
                    <Mail className="size-4" />
                    Compose
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="gap-2">
                    <FileText className="size-4" />
                    Templates
                    <Badge variant="secondary" className="text-[9px]">
                      {EMAIL_TEMPLATES.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="compose" className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="email-subject" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Tag className="size-3.5" />
                    Subject
                  </Label>
                  <Input
                    id="email-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject"
                    className="focus-visible:ring-offset-0"
                    disabled={previewMode}
                  />
                </div>

                {/* Body */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-body" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <AlignLeft className="size-3.5" />
                      Message
                    </Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{body.split('\n').filter(l => l.trim()).length} lines</span>
                      <span>·</span>
                      <span>{body.length} characters</span>
                    </div>
                  </div>
                  {previewMode ? (
                    <div className="min-h-[200px] p-4 rounded-lg border bg-muted/10 prose prose-sm max-w-none">
                      {body.split('\n').map((line, i) => (
                        <p key={i} className="leading-relaxed">{line || <br />}</p>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      id="email-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your message here... Use {{variable}} for dynamic content"
                      className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ resize: 'vertical' }}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="templates" className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat === "all" ? "All Templates" : getCategoryLabel(cat)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">
                        {filteredTemplates.length} templates
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilterCategory("all")}
                      className="text-xs"
                    >
                      Clear filter
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {filteredTemplates.map((template) => {
                      const Icon = template.icon;
                      return (
                        <div
                          key={template.id}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md",
                            selectedTemplate === template.id
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/30"
                          )}
                          onClick={() => applyTemplate(template.id)}
                        >
                          <div className={cn(
                            "size-10 rounded-lg flex items-center justify-center shrink-0 border",
                            getCategoryColor(template.category)
                          )}>
                            <Icon className="size-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold">{template.name}</h4>
                              <Badge
                                variant="outline"
                                className={cn("text-[9px]", getCategoryColor(template.category))}
                              >
                                {getCategoryLabel(template.category)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {template.description}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {template.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-[9px] px-1.5 py-0"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {template.subject}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                applyTemplate(template.id);
                              }}
                            >
                              <Copy className="size-3.5 mr-1" />
                              Use
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <DialogFooter className="border-t px-6 py-4 mt-auto">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {selectedTemplate && (
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="size-3" />
                      Template: {EMAIL_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                    </Badge>
                  )}
                  {previewMode && (
                    <Badge variant="outline" className="gap-1">
                      <Eye className="size-3" />
                      Preview Mode
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      onOpenChange(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={!subject.trim() || !body.trim() || isSending}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 size-4" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Export ─── */

export {
  CreateUserSheet,
  EditUserDialog,
  DeleteUserDialog,
  BulkDeleteDialog,
  generatePassword,
  RoleBadge,
  EmailDialog
};