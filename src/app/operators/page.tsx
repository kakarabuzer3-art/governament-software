import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";

export const metadata: Metadata = { title: "Operators & Vehicles" };

export default function OperatorsPage() {
  return (
    <ModulePlaceholder
      icon="users"
      phase={3}
      title="Operators & Vehicles"
      description="Controlled records for transport operators, vehicles, routes, terminals, drivers and permits, with relationships, validation and compliance history."
      bullets={[
        "Operator and vehicle records with uniqueness checks and server-side validation.",
        "Routes, terminals and permit records — permit status only from verified sources (pending departmental confirmation).",
        "Operator and vehicle compliance history with audit events for every change.",
      ]}
    />
  );
}
