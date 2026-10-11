import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";

export const metadata: Metadata = { title: "CCTV & Inspections" };

export default function InspectionsPage() {
  return (
    <ModulePlaceholder
      icon="camera"
      phase={5}
      title="CCTV & Inspections"
      description="Record CCTV installation and inspection results: functioning status, inspection dates, findings, responsible party and follow-up actions."
      bullets={[
        "Inspection records with findings, responsible party and documented follow-up.",
        "No live video streaming, footage storage or facial recognition — these require separate written approval and legal review.",
        "Camera status is only ever recorded from actual inspections — never simulated.",
      ]}
    />
  );
}
