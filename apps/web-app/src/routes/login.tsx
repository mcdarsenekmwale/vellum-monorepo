import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { useAuthState } from "@/hooks/useApi";
import { getRedirectUrl } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const LEFT_IMAGE = "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=2070&auto=format&fit=crop";

function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    const search = router.state.location.search as Record<string, string>;
    const redirect = getRedirectUrl(search);
    router.navigate({ to: redirect });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      const search = router.state.location.search as Record<string, string>;
      const redirect = getRedirectUrl(search);
      router.navigate({ to: redirect });
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Panel — Immersive Imagery */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        <img
          src={LEFT_IMAGE}
          alt="Atmospheric reading scene"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Warm overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Content on image */}
        <div className="relative z-10 flex flex-col justify-end p-12 xl:p-16">
          <Link
            to="/"
            className="absolute top-10 left-10 xl:left-16 text-white font-display italic text-3xl tracking-tight hover:opacity-80 transition-opacity"
          >
            Vellum.
          </Link>

          <blockquote className="max-w-md">
            <p className="text-white/90 text-xl xl:text-2xl font-serif italic leading-relaxed">
              "The pen is mightier than the sword, but the keyboard is mightier than both."
            </p>
            <footer className="mt-4 text-white/50 text-sm font-medium tracking-wide uppercase">
              — Join the community of thinkers & writers
            </footer>
          </blockquote>

          {/* Stats row */}
          <div className="flex gap-10 mt-10 pt-8 border-t border-white/10">
            <div>
              <p className="text-2xl xl:text-3xl font-bold text-white">12K+</p>
              <p className="text-white/40 text-sm mt-1">Writers</p>
            </div>
            <div>
              <p className="text-2xl xl:text-3xl font-bold text-white">48K+</p>
              <p className="text-white/40 text-sm mt-1">Stories</p>
            </div>
            <div>
              <p className="text-2xl xl:text-3xl font-bold text-white">2M+</p>
              <p className="text-white/40 text-sm mt-1">Readers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Form (Light Premium Background) */}
      <div className="w-full lg:w-1/2 xl:w-[45%] bg-[#f7f4ee] flex items-center justify-center px-6 sm:px-12 py-12 relative">
        {/* Mobile logo */}
        <Link
          to="/"
          className="lg:hidden absolute top-8 left-8 text-foreground font-display italic text-2xl tracking-tight"
        >
          Vellum.
        </Link>

        <div className="w-full max-w-[420px]">
          {/* Header */}
          <div className="mb-10">
            <p className="text-[#d97706] text-sm font-semibold tracking-widest uppercase mb-3">
              Welcome back
            </p>
            <h1 className="text-foreground text-4xl sm:text-5xl font-serif italic leading-tight">
              Sign in to<br />your account
            </h1>
            <p className="text-muted-foreground mt-4 text-base">
              Enter your details to access your stories, bookmarks, and more.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div className="group">
              <label className="block text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-3">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 size-5 text-muted-foreground/50 group-focus-within:text-[#d97706] transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-9 pr-4 py-3 bg-transparent border-b border-border text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d97706] transition-colors text-base"
                />
              </div>
            </div>

            {/* Password */}
            <div className="group">
              <label className="block text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-3">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 size-5 text-muted-foreground/50 group-focus-within:text-[#d97706] transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={6}
                  className="w-full pl-9 pr-12 py-3 bg-transparent border-b border-border text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d97706] transition-colors text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border bg-transparent checked:bg-[#d97706] checked:border-[#d97706] accent-[#d97706]"
                />
                <span className="text-muted-foreground text-sm group-hover:text-foreground transition-colors">
                  Remember me
                </span>
              </label>
              <Link
                to={"/forgot-password" as any}
                className="text-[#d97706] text-sm font-medium hover:text-[#e88d1f] transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="group w-full py-4 rounded-xl font-semibold text-base text-white bg-gradient-to-r from-[#b45309] via-[#d97706] to-[#f59e0b] hover:from-[#92400e] hover:via-[#b45309] hover:to-[#d97706] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#d97706]/20"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs uppercase tracking-[0.2em]">or continue with</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 hover:bg-muted transition-all text-sm font-medium">
              <svg className="size-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 hover:bg-muted transition-all text-sm font-medium">
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Apple
            </button>
          </div>

          {/* Register link */}
          <p className="text-center text-muted-foreground text-sm mt-10">
            New to Vellum?{" "}
            <Link
              to="/register"
              search={router.state.location.search}
              className="text-[#d97706] font-semibold hover:text-[#e88d1f] transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}