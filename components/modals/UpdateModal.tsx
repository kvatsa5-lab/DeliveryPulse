"use client";

import { useState } from "react";
import { Modal, ModalActions, FieldError } from "@/components/ui/Modal";
import { ENGAGEMENT_STATUSES } from "@/lib/constants/statuses";
import type { Engagement } from "@/types/engagement";

export function UpdateModal({
  engagements,
  initialId,
  onClose,
  onSubmit,
  pending,
  fieldErrors,
}: {
  engagements: Engagement[];
  initialId: number;
  onClose: () => void;
  onSubmit: (payload: {
    engagementId: number;
    status: string;
    progress: string;
    nextStep: string;
    risk: string;
  }) => void;
  pending: boolean;
  fieldErrors: Record<string, string>;
}) {
  const [engagementId, setEngagementId] = useState(initialId);
  const record =
    engagements.find((item) => item.id === engagementId) ?? engagements[0];

  return (
    <Modal
      label={`WEEKLY UPDATE · ${record?.customer.toUpperCase() ?? ""}`}
      title="What materially changed this week?"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit({
          engagementId,
          status: String(form.get("status") ?? ""),
          progress: String(form.get("progress") ?? ""),
          nextStep: String(form.get("nextStep") ?? ""),
          risk: String(form.get("risk") ?? ""),
        });
      }}
      footer={
        <ModalActions
          onCancel={onClose}
          submitLabel="Submit weekly update"
          pending={pending}
        />
      }
    >
      {/* Let the engineer switch target without closing and reopening the dialog. */}
      <label>
        Engagement
        <select
          name="engagementId"
          value={engagementId}
          onChange={(event) => setEngagementId(Number(event.target.value))}
        >
          {engagements.map((item) => (
            <option key={item.id} value={item.id}>
              {item.customer} — {item.title}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.engagementId} />
      </label>

      <label>
        Progress
        <textarea
          name="progress"
          defaultValue={record?.progress ?? ""}
          maxLength={4000}
          required
        />
        <FieldError message={fieldErrors.progress} />
      </label>

      <label>
        Current state
        <select name="status" defaultValue={record?.status}>
          {ENGAGEMENT_STATUSES.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <FieldError message={fieldErrors.status} />
      </label>

      <label>
        Next step and owner
        <textarea
          name="nextStep"
          defaultValue={record?.nextStep ?? ""}
          maxLength={2000}
          required
        />
        <FieldError message={fieldErrors.nextStep} />
      </label>

      <label>
        Risk / blocker
        <textarea
          name="risk"
          defaultValue={record?.risk ?? "None"}
          maxLength={2000}
          required
        />
        <FieldError message={fieldErrors.risk} />
      </label>
    </Modal>
  );
}
