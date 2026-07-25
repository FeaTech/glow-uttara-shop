import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Truck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const authSearchSchema = (value: Record<string, unknown>) => ({
  redirect: typeof value.redirect === "string" ? value.redirect : undefined,
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FEA Glam" },
      { name: "description", content: "Sign in or create an account to shop luxury beauty products at FEA Glam." },
    ],
  }),
  validateSearch: authSearchSchema,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: redirect ?? "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Please check your email to confirm.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/images/hero-luxe.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            FEA<span className="text-primary">Glam</span>
          </Link>
          <div className="max-w-sm">
            <h2 className="font-serif text-4xl font-light leading-tight text-foreground">
              Beauty, <span className="italic text-gradient-gold">elevated.</span>
            </h2>
            <div className="mt-8 space-y-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /> 100% authentic luxury brands</p>
              <p className="flex items-center gap-3"><Truck className="h-5 w-5 text-primary" /> Fast, tracked pan-India delivery</p>
              <p className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-primary" /> Exclusive member offers &amp; early access</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center lg:hidden">
            <Link to="/" className="font-heading text-3xl font-semibold tracking-tight">
              FEA<span className="text-primary">Glam</span>
            </Link>
          </div>
          <h1 className="mt-6 font-serif text-3xl font-light text-foreground">
            {tab === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "signin" ? "Sign in to continue shopping premium beauty." : "Join FEA Glam for a curated beauty experience."}
          </p>

          <Tabs value={tab} onValueChange={setTab} className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <form onSubmit={handleEmailAuth}>
              <TabsContent value="signin" className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
                </div>
                <Button type="submit" className="btn-gold w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!email) return toast.error("Enter your email first");
                    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
                    if (error) toast.error(error.message);
                    else toast.success("Password reset link sent");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
                </div>
                <Button type="submit" className="btn-gold w-full" disabled={loading}>
                  {loading ? "Creating account…" : "Create account"}
                </Button>
              </TabsContent>
            </form>
          </Tabs>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
            </div>
            <Button variant="outline" className="mt-4 w-full" onClick={handleGoogle}>Continue with Google</Button>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to store</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
