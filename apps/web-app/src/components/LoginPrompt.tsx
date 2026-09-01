import { Link, useRouterState } from "@tanstack/react-router";
import { X, LogIn } from "lucide-react";
import { useState } from "react";

interface LoginPromptProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  action?: string;
}

export function LoginPrompt({ isOpen, open, onClose, action = "perform this action" }: LoginPromptProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visible = isOpen ?? open ?? false;

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-entry">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-5" />
        </button>

        <div className="text-center">
          <div className="size-14 rounded-full bg-accent/10 grid place-items-center mx-auto mb-4">
            <LogIn className="size-7 text-accent" />
          </div>

          <h3 className="text-xl font-semibold mb-2">Sign in required</h3>
          <p className="text-muted-foreground text-sm mb-6">
            You need to sign in to {action}. Join Vellbase to unlock all features.
          </p>

          <div className="space-y-3">
            <Link
              to="/login"
              search={{ redirect: pathname }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-foreground text-background font-semibold hover:opacity-90 transition-opacity"
            >
              <LogIn className="size-5" />
              Sign In
            </Link>
            <Link
              to="/register"
              search={{ redirect: pathname }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors"
            >
              Create Account
            </Link>
          </div>

          <button
            onClick={onClose}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue browsing as guest
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for using login prompt
export function useLoginPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState("perform this action");

  const promptLogin = (actionText?: string) => {
    if (actionText) setAction(actionText);
    setIsOpen(true);
  };

  const closePrompt = () => setIsOpen(false);

  return {
    isOpen,
    action,
    promptLogin,
    closePrompt,
    LoginPromptComponent: () => (
      <LoginPrompt isOpen={isOpen} onClose={closePrompt} action={action} />
    ),
  };
}
