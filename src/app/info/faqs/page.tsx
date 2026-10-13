import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Provisional frequently asked questions about this unapproved transport security and compliance development prototype.",
  alternates: { canonical: "/info/faqs" },
};

const FAQS = [
  {
    question: "Is this an official government website?",
    answer:
      "No. This is an unapproved development prototype for a proposed workflow. It is not an official, certified or endorsed government service, and nothing on it should be relied upon.",
  },
  {
    question: "Does this site hold real passenger information?",
    answer:
      "No. The prototype is populated with synthetic test data only. It contains no real passenger records and no real identity numbers.",
  },
  {
    question: "Can I apply for or check a permit here?",
    answer:
      "No. The prototype only stores permit records entered by authorised users. It is not connected to any issuing authority and cannot verify a permit.",
  },
  {
    question: "How is personal information protected?",
    answer:
      "In the prototype, passenger identity numbers, mobile numbers and addresses are encrypted before storage and shown masked in ordinary views. Reading a full value requires a specific permission and is recorded in the audit trail. Production use would additionally require an approved key-management service and a departmental retention and legal-hold policy.",
  },
  {
    question: "How can I get access to the administrative portal?",
    answer:
      "Access is restricted. Accounts are created by an administrator; there is no public sign-up. Contact the responsible department once it has confirmed ownership of the system.",
  },
  {
    question: "Are these answers final?",
    answer:
      "No. Every answer on this page is provisional placeholder content awaiting departmental approval, and will be replaced by approved text.",
  },
] as const;

export default function FaqsPage() {
  return (
    <PublicShell
      title="Frequently asked questions"
      intro="Provisional answers about this development prototype. They will be replaced by department-approved text."
      activeHref="/info/faqs"
    >
      <dl className="public-faq">
        {FAQS.map((item) => (
          <div key={item.question}>
            <dt>{item.question}</dt>
            <dd>{item.answer}</dd>
          </div>
        ))}
      </dl>
    </PublicShell>
  );
}
