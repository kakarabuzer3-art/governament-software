import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";

export const metadata: Metadata = { title: "Trips & Manifests" };

export default function TripsPage() {
  return (
    <ModulePlaceholder
      icon="route"
      phase={4}
      title="Trips & Manifests"
      description="Journey creation and passenger manifests: name, father's name, identity document number, address, mobile number and journey details, validated on client and server."
      bullets={[
        "Passenger manifest entries linked to the correct trip and vehicle — no permanent passenger profiles.",
        "Sensitive identity values masked in routine views, encrypted at rest, excluded from logs.",
        "Authorized search, correction and controlled export with audit events.",
        "Retention foundation: minimum 10-day retention where applicable, final policy pending departmental approval.",
      ]}
    />
  );
}
