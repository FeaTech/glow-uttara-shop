import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollReveal } from "@/components/ScrollReveal";
import { submitContactForm } from "@/lib/email.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us — FEA Glam" },
      { name: "description", content: "Get in touch with the FEA Glam customer care team." },
    ],
  }),
  component: ContactPage,
});

const details = [
  { icon: Mail, label: "Email", value: "Mail@Feaglam.com" },
  { icon: Phone, label: "Phone", value: "+91 99629 99336" },
  { icon: Clock, label: "Hours", value: "Mon–Sat, 10am – 7pm IST" },
];

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const submitFn = useServerFn(submitContactForm);

  const mutation = useMutation({
    mutationFn: submitFn,
    onSuccess: () => {
      setSent(true);
      toast.success("Thanks! Our team will get back to you within 24 hours.");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not send your message"),
  });

  const submit = (e: React.FormEvent) => {
    console.log("[contact] submit handler called", { submitFn: typeof submitFn, mutation: typeof mutation.mutate });
    e.preventDefault();
    mutation.mutate({
      data: {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      },
    });
    console.log("[contact] mutation.mutate called");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <div className="container-luxe py-16 text-center">
          <div className="rule-gold mx-auto" />
          <h1 className="mt-4 font-serif text-4xl font-light text-foreground md:text-5xl">We'd love to help</h1>
          <p className="mt-3 text-muted-foreground">
            Questions about an order or a product? Reach out — we reply fast.
          </p>
        </div>
      </div>

      <div className="container-luxe grid max-w-5xl gap-10 py-14 lg:grid-cols-2">
        <ScrollReveal>
          <div className="space-y-4">
            {details.map(({ icon: Icon, label, value }) => (
              <div key={label} className="card-luxe flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="font-medium text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <form onSubmit={submit} className="card-luxe space-y-4 p-6">
            <h2 className="font-serif text-2xl font-light text-foreground">Send us a message</h2>
            {sent ? (
              <p className="rounded-md bg-primary/10 p-4 text-sm text-primary">
                Your message has been received. We'll be in touch soon!
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input
                      required
                      className="mt-1.5"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      required
                      className="mt-1.5"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input
                    className="mt-1.5"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    required
                    rows={5}
                    minLength={5}
                    className="mt-1.5"
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="btn-gold w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Sending…" : "Send message"}
                </Button>
              </>
            )}
          </form>
        </ScrollReveal>
      </div>
    </div>
  );
}
