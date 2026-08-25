import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { WebShell } from "@/components/WebShell";
import { Avatar } from "@/components/Avatar";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useApi";
import { ArrowLeft, Camera, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile/edit")({
  head: () => ({
    meta: [
      { title: "Edit profile — Vellbase" },
      {
        name: "description",
        content: "Update your name, handle, bio and avatar on Vellbase.",
      },
    ],
  }),
  beforeLoad: async () => {
    const user = await apiClient.getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: "/profile/edit" } });
    }
  },
  component: EditProfilePage,
});

function EditProfilePage() {
  const nav = useNavigate();
  const { user, isLoading: authLoading } = useAuthState();

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setHandle(user.handle.replace(/^@/, ""));
      setBio(user.bio || "");
      setAvatar(user.avatar || "");
    }
  }, [user]);

  const cancel = () => nav({ to: "/profile" });

  const save = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.updateUser({
        name: name.trim(),
        handle: handle.trim(),
        bio: bio.trim(),
        avatar: avatar || undefined,
      });
      toast.success("Profile updated");
      nav({ to: "/profile" });
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <WebShell>
        <div className="max-w-[680px] mx-auto py-20 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-28 w-28 bg-muted rounded-full mx-auto" />
            <div className="h-8 w-48 bg-muted rounded mx-auto" />
          </div>
        </div>
      </WebShell>
    );
  }

  return (
    <WebShell>
      <div className="max-w-[680px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={cancel}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <h1 className="text-3xl font-display italic">Edit profile</h1>
          <button
            onClick={save}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
          >
            <Check className="size-3" />
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-2xl p-6 md:p-10 space-y-8">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <Avatar
                src={avatar}
                name={name}
                handle={handle}
                size="2xl"
                className="size-28 ring-4 ring-accent ring-offset-4 ring-offset-card"
              />
              <button
                type="button"
                aria-label="Change avatar"
                onClick={() => setAvatar(avatar)}
                className="absolute inset-0 size-28 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-white"
              >
                <Camera className="size-6" />
              </button>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Tap to change photo
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-transparent outline-none border-b border-border py-2 text-lg focus:border-accent transition-colors"
            />
          </div>

          {/* Handle */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Handle
            </label>
            <div className="flex items-center border-b border-border focus-within:border-accent transition-colors">
              <span className="text-lg text-muted-foreground py-2">@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                placeholder="yourhandle"
                className="w-full bg-transparent outline-none py-2 text-lg"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short bio about you…"
              rows={4}
              className="w-full bg-transparent outline-none border-b border-border py-2 text-base resize-none focus:border-accent transition-colors"
            />
          </div>
        </div>
      </div>
    </WebShell>
  );
}
