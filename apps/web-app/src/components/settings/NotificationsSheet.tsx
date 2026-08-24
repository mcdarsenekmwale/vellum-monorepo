import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/settings/BottomSheet";
import { RowSwitch } from "@/components/settings/RowSwitch";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettingsStore } from "@/components/providers/SettingsStore";
import { Loader2 } from "lucide-react";

type FineToggle =
  | "likeNotifications"
  | "commentNotifications"
  | "replyNotifications"
  | "followNotifications"
  | "mentionNotifications"
  | "newArticleNotifications"
  | "systemNotifications"
  | "digestEnabled"
  | "marketingEnabled";

const FINE_KEYS: FineToggle[] = [
  "likeNotifications",
  "commentNotifications",
  "replyNotifications",
  "followNotifications",
  "mentionNotifications",
  "newArticleNotifications",
  "systemNotifications",
  "digestEnabled",
  "marketingEnabled",
];

const FINE_LABEL_KEY: Record<FineToggle, string> = {
  likeNotifications: "settings.notifyLikes",
  commentNotifications: "settings.notifyComments",
  replyNotifications: "settings.notifyReplies",
  followNotifications: "settings.notifyFollows",
  mentionNotifications: "settings.notifyMentions",
  newArticleNotifications: "settings.notifyNewArticles",
  systemNotifications: "settings.notifySystem",
  digestEnabled: "settings.notifyEmailDigest",
  marketingEnabled: "settings.notifyEmailMarketing",
};

export function NotificationsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { notifications, setNotifications, isBackendLoading } = useSettingsStore();

  // Fine-grained toggles derived from pushNotifications master switch.
  const [fine, setFine] = useState<Record<FineToggle, boolean>>({
    likeNotifications: true,
    commentNotifications: true,
    replyNotifications: true,
    followNotifications: true,
    mentionNotifications: false,
    newArticleNotifications: false,
    systemNotifications: true,
    digestEnabled: false,
    marketingEnabled: notifications.emailMarketing,
  });

  const masterDisabled = useMemo(() => !notifications.pushNotifications, [notifications.pushNotifications]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("settings.sectionsNotifications")}
      description={t("settings.sectionsNotificationsDescription")}
      dataTestId="notifications-sheet"
    >
      <div className="space-y-5 text-sm">
        <section className="space-y-3">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {t("settings.pushNotifications")}
          </h4>
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 border border-border">
            <span className="font-medium text-foreground">
              {t("settings.pushNotifications")}
            </span>
            <RowSwitch
              checked={notifications.pushNotifications}
              onChange={(v) => setNotifications({ pushNotifications: v })}
              dataTestId="notifications-toggle-push"
              label={t("settings.pushNotifications")}
            />
          </div>
          <div className={masterDisabled ? "opacity-60 pointer-events-none" : ""}>
            {FINE_KEYS.map((k) => (
              <div
                key={k}
                className="flex items-center justify-between px-2 py-2.5 border-b border-border/60 last:border-b-0"
              >
                <span className="text-foreground/90 text-[14px]">
                  {t(FINE_LABEL_KEY[k])}
                </span>
                <RowSwitch
                  checked={fine[k]}
                  onChange={(v) =>
                    setFine((f) => ({ ...f, [k]: v }))
                  }
                  dataTestId={`notifications-toggle-${k}`}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {t("settings.emailNotifications")}
          </h4>
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 border border-border">
            <span className="font-medium text-foreground">
              {t("settings.emailNotifications")}
            </span>
            <RowSwitch
              checked={notifications.emailNotifications}
              onChange={(v) => setNotifications({ emailNotifications: v })}
              dataTestId="notifications-toggle-email"
              label={t("settings.emailNotifications")}
            />
          </div>
          <div className="flex items-center justify-between px-2 py-2.5">
            <span className="text-foreground/90 text-[14px]">
              {t("settings.notifyEmailMarketing")}
            </span>
            <RowSwitch
              checked={notifications.emailMarketing}
              onChange={(v) => setNotifications({ emailMarketing: v })}
              dataTestId="notifications-toggle-marketing"
            />
          </div>
        </section>

        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          {isBackendLoading && (
            <>
              <Loader2 className="size-3 animate-spin" />
              <span>Synchronizing…</span>
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
