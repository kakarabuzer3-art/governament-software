"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/icons";

/**
 * Dashboard header action that demonstrates the glass modal.
 * It honestly explains that real exports arrive in Phase 6 —
 * it does not fake a download.
 */
export function DashboardActions() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Icon name="download" size={16} />
        Export preview
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Exports arrive in Phase 6"
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setOpen(false)}
          >
            Understood
          </button>
        }
      >
        <p>
          PDF, CSV and Excel exports of journeys and reports will be
          implemented in Phase 6, protected by server-side permission checks
          and recorded in the audit trail.
        </p>
        <p>
          No file has been generated — this dialog demonstrates the glass
          modal interaction (Escape or the backdrop also closes it).
        </p>
      </Modal>
    </>
  );
}
