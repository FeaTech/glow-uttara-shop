import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/ScrollReveal";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQs — FEALuxy" },
      { name: "description", content: "Answers to common questions about shopping, shipping, returns, and payments at FEALuxy." },
    ],
  }),
  component: FaqPage,
});

const faqs = [
  { q: "Are all products 100% authentic?", a: "Yes. Every product sold on FEALuxy is sourced directly from authorised brands or distributors. We never sell counterfeit or grey-market goods." },
  { q: "How long does delivery take?", a: "Metro cities typically receive orders in 2–4 business days, and the rest of India within 4–7 business days. You'll get a tracking link once your order ships." },
  { q: "What is your return policy?", a: "Unopened products can be returned within 7 days of delivery for a full refund. For hygiene reasons, opened cosmetics and skincare cannot be returned unless they arrived damaged or defective." },
  { q: "Which payment methods do you accept?", a: "We accept cash on delivery, along with UPI, credit/debit cards, and net banking via our secure online payment option at checkout." },
  { q: "Do you offer cash on delivery?", a: "Yes, cash on delivery is available across most serviceable pincodes in India." },
  { q: "How do I use a coupon code?", a: "Add items to your cart, proceed to checkout, and enter your coupon code in the 'Coupon code' box in the order summary. The discount applies instantly once validated." },
  { q: "Can I cancel my order?", a: "Orders can be cancelled from your Orders page while they are still 'Pending' or 'Processing'. Once shipped, an order can no longer be cancelled." },
  { q: "How do I track my order?", a: "Sign in and visit My Orders to see live status for each order, from placed through to delivered." },
];

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <div className="container-luxe py-16 text-center">
          <div className="rule-gold mx-auto" />
          <h1 className="mt-4 font-serif text-4xl font-light text-foreground md:text-5xl">Frequently asked questions</h1>
          <p className="mt-3 text-muted-foreground">Everything you need to know about shopping with FEALuxy.</p>
        </div>
      </div>
      <div className="container-luxe max-w-3xl py-14">
        <ScrollReveal>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left font-medium">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </div>
  );
}
