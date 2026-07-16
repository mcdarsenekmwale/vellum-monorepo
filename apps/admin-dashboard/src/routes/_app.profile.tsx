import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Camera,
  Trash2,
  Loader2,
  Mail,
  AtSign,
  UserCircle,
  Shield,
  Fingerprint,
  Calendar,
  CheckCircle2,
  KeyRound,
  Smartphone,
  Globe,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { avatarUrl } from "@/lib/avatar";
import { useAuth } from "@/lib/auth/context";
import { useUpdateUser, useUploadAvatar, useRemoveAvatar, useUpdateUserSettings } from "@/lib/api/hooks";
import { API_BASE_URL } from "@/lib/api/client";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile · AI Article Workspace Admin" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const updateUser = useUpdateUser();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const updateUserSettings = useUpdateUserSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    handle: "",
    email: "",
    bio: "",
    website: "",
    location: "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name ?? "",
        handle: user.handle?.replace(/^@/, "") ?? "",
        email: user.email ?? "",
        bio: user.bio ?? "",
        website: user.website ?? "",
        location: user.location ?? "",
      });
      setTwoFactorEnabled(user.twoFactorEnabled ?? false);
      setEmailNotifications(user.emailNotifications ?? true);
    }
  }, [user]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!user) return;
    updateUser.mutate(
      {
        id: user.id,
        name: formData.name,
        handle: formData.handle.replace(/^@/, ""),
        email: formData.email,
        bio: formData.bio,
        website: formData.website,
        location: formData.location,
      },
      {
        onSuccess: async () => {
          await refreshUser();
          toast.success("Profile updated", {
            description: "Your changes have been saved successfully.",
          });
        },
        onError: (error: any) => {
          toast.error("Update failed", {
            description: error?.message || "Something went wrong. Please try again.",
          });
        },
      }
    );
  };

  const handleCancel = () => {
    if (!user) return;
    setFormData({
      name: user.name ?? "",
      handle: user.handle?.replace(/^@/, "") ?? "",
      email: user.email ?? "",
      bio: user.bio ?? "",
      website: user.website ?? "",
      location: user.location ?? "",
    });
    setAvatarPreview(null);
    toast.info("Changes discarded");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum file size is 5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    uploadAvatar.mutate(
      { id: user.id, file },
      {
        onSuccess: async () => {
          await refreshUser();
          toast.success("Photo updated");
          setAvatarPreview(null);
        },
        onError: (err: any) => {
          toast.error("Upload failed", {
            description: err?.message || "Something went wrong.",
          });
          setAvatarPreview(null);
        },
      }
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = () => {
    if (!user) return;
    if (!confirm("Remove your profile photo?")) return;

    removeAvatar.mutate(user.id, {
      onSuccess: async () => {
        await refreshUser();
        toast.success("Photo removed");
      },
      onError: (err: any) => {
        toast.error("Failed to remove photo", {
          description: err?.message || "Something went wrong.",
        });
      },
    });
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleEmailNotificationsChange = (checked: boolean) => {
    setEmailNotifications(checked);
    updateUserSettings.mutate(
      { emailNotifications: checked },
      {
        onSuccess: async () => {
          await refreshUser();
        },
        onError: () => {
          setEmailNotifications(!checked);
          toast.error("Failed to update notification settings");
        },
      }
    );
  };

  const getAvatarSrc = () => {
    if (avatarPreview) return avatarPreview;
    if (user?.avatar) {
      if (user.avatar.startsWith("http")) return user.avatar;
      return `${API_BASE_URL}${user.avatar}`;
    }
    return avatarUrl(user?.avatarSeed ?? user?.id ?? "admin");
  };

  const isDirty =
    formData.name !== (user?.name ?? "") ||
    formData.handle !== (user?.handle?.replace(/^@/, "") ?? "") ||
    formData.email !== (user?.email ?? "") ||
    formData.bio !== (user?.bio ?? "") ||
    formData.website !== (user?.website ?? "") ||
    formData.location !== (user?.location ?? "");

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="Manage your personal information and account preferences."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SectionCard className="lg:col-span-4 p-0 overflow-hidden">
          <div className="relative h-24 bg-gradient-to-br from-primary/20 to-primary/5" />
          <div className="px-6 pb-6 -mt-12">
            <div className="relative inline-block">
              <Avatar className="size-24 ring-4 ring-background">
                <AvatarImage
                  src={getAvatarSrc()}
                  alt={user?.name}
                />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary font-semibold">
                  {user?.name?.[0]?.toUpperCase() ?? "A"}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handleTriggerUpload}
                disabled={uploadAvatar.isPending}
                className="absolute -bottom-1 -right-1 size-8 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
                title="Change photo"
              >
                {uploadAvatar.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Camera className="size-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploadAvatar.isPending}
              />
            </div>

            <div className="mt-4 space-y-1">
              <h3 className="font-semibold text-lg">{user?.name ?? "Admin User"}</h3>
              <p className="text-sm text-muted-foreground">@{user?.handle?.replace(/^@/, "") ?? "handle"}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Shield className="size-3" />
                  {user?.role ?? "Member"}
                </Badge>
                {user?.isVerified && (
                  <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-200">
                    <CheckCircle2 className="size-3" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Mail className="size-4" />
                <span className="truncate">{user?.email ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Calendar className="size-4" />
                <span>Joined {memberSince}</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Fingerprint className="size-4" />
                <span className="font-mono text-xs">{user?.id?.slice(0, 12) ?? "—"}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={handleTriggerUpload}
                disabled={uploadAvatar.isPending}
              >
                {uploadAvatar.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Camera className="size-3.5" />
                )}
                Change
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleRemovePhoto}
                disabled={removeAvatar.isPending || !user?.avatar}
              >
                {removeAvatar.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </SectionCard>

        <div className="lg:col-span-8 space-y-6">
          <SectionCard
            title="Personal information"
            description="Update your basic profile details."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium flex items-center gap-1.5">
                  <UserCircle className="size-3.5 text-muted-foreground" />
                  Full name
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="handle" className="text-xs font-medium flex items-center gap-1.5">
                  <AtSign className="size-3.5 text-muted-foreground" />
                  Handle
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    @
                  </span>
                  <Input
                    id="handle"
                    value={formData.handle}
                    onChange={(e) => handleChange("handle", e.target.value.replace(/^@/, ""))}
                    placeholder="username"
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" />
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-xs font-medium flex items-center gap-1.5">
                  <Shield className="size-3.5 text-muted-foreground" />
                  Role
                </Label>
                <Input id="role" value={user?.role ?? ""} disabled className="bg-muted/50" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bio" className="text-xs font-medium">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleChange("bio", e.target.value)}
                  placeholder="Tell others about yourself..."
                  rows={3}
                  className="resize-none"
                  maxLength={280}
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {formData.bio.length}/280
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Additional details"
            description="Optional information to enrich your profile."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="website" className="text-xs font-medium flex items-center gap-1.5">
                  <Globe className="size-3.5 text-muted-foreground" />
                  Website
                </Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  placeholder="https://your-website.com"
                  type="url"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-xs font-medium flex items-center gap-1.5">
                  <Smartphone className="size-3.5 text-muted-foreground" />
                  Location
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="City, Country"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Preferences"
            description="Manage your account settings and notifications."
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    Email notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive updates about your account activity
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={handleEmailNotificationsChange}
                  disabled={updateUserSettings.isPending}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <KeyRound className="size-4 text-muted-foreground" />
                    Two-factor authentication
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={setTwoFactorEnabled}
                  disabled
                />
              </div>
              {twoFactorEnabled === false && (
                <p className="text-[11px] text-muted-foreground pl-6">
                  2FA setup is coming soon. Check back later.
                </p>
              )}
            </div>
          </SectionCard>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {isDirty ? (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved changes
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="size-4" />
                  All changes saved
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={updateUser.isPending || !isDirty}
              >
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateUser.isPending || !isDirty}
                className="gap-1.5 min-w-[100px]"
              >
                {updateUser.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Account status"
          value={user?.isActive ? "Active" : "Inactive"}
          tone={user?.isActive ? "success" : "warning"}
          icon={Shield}
        />
        <StatCard
          label="Security"
          value={twoFactorEnabled ? "2FA On" : "2FA Off"}
          tone={twoFactorEnabled ? "success" : "info"}
          icon={KeyRound}
        />
        <StatCard
          label="Member ID"
          value={`#${user?.id?.slice(0, 6) ?? "—"}`}
          tone="primary"
          icon={Fingerprint}
        />
        <StatCard
          label="Last login"
          value={user?.lastLoginAt ? "Today" : "—"}
          tone="info"
          icon={Calendar}
        />
      </div>
    </div>
  );
}
