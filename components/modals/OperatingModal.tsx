"use client";

import { useState } from "react";
import { Modal, ModalActions, FieldError } from "@/components/ui/Modal";
import {
  ARCHITECTURES,
  ENVIRONMENTS,
  IMPROVEMENT_CATEGORIES,
  PRODUCTS,
  SKILL_RATINGS,
} from "@/lib/constants/statuses";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants/attachments";
import { formatBytes } from "@/lib/utils/date";
import type { OperatingRecordType } from "@/types/operating";

const TITLES: Record<OperatingRecordType, string> = {
  improvements: "Log improvement",
  runbooks: "Add runbook",
  assessments: "Add skill assessment",
};

export function OperatingModal({
  type,
  onClose,
  onSubmit,
  pending,
  fieldErrors,
}: {
  type: OperatingRecordType;
  onClose: () => void;
  onSubmit: (form: FormData) => void;
  pending: boolean;
  fieldErrors: Record<string, string>;
}) {
  const [fileNote, setFileNote] = useState("");

  return (
    <Modal
      label="OPERATING RECORD"
      title={TITLES[type]}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        form.set("type", type);
        onSubmit(form);
      }}
      footer={
        <ModalActions onCancel={onClose} submitLabel="Save record" pending={pending} />
      }
    >
      {type === "improvements" && (
        <>
          <label>
            Improvement title
            <input name="title" maxLength={200} required />
            <FieldError message={fieldErrors.title} />
          </label>
          <label>
            Category
            <select name="category">
              {IMPROVEMENT_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <FieldError message={fieldErrors.category} />
          </label>
          <label>
            Owner
            <input name="owner" maxLength={120} required />
            <FieldError message={fieldErrors.owner} />
          </label>
          <label>
            Observed impact
            <textarea name="impact" maxLength={2000} required />
            <FieldError message={fieldErrors.impact} />
          </label>
        </>
      )}

      {type === "runbooks" && (
        <>
          <label>
            Runbook title
            <input name="title" maxLength={200} required />
            <FieldError message={fieldErrors.title} />
          </label>
          <label>
            Product
            <select name="product">
              {PRODUCTS.map((product) => (
                <option key={product}>{product}</option>
              ))}
            </select>
            <FieldError message={fieldErrors.product} />
          </label>
          <label>
            Environment
            <select name="environment">
              {ENVIRONMENTS.map((environment) => (
                <option key={environment}>{environment}</option>
              ))}
            </select>
            <FieldError message={fieldErrors.environment} />
          </label>
          <label>
            Architecture
            <input
              name="architecture"
              placeholder="e.g. HA, installation, networking"
              list="architecture-suggestions"
              maxLength={160}
              required
            />
            {/* Free text, but suggest the canonical values for consistency. */}
            <datalist id="architecture-suggestions">
              {ARCHITECTURES.map((architecture) => (
                <option key={architecture} value={architecture} />
              ))}
            </datalist>
            <FieldError message={fieldErrors.architecture} />
          </label>
          <label>
            Owner / author
            <input name="owner" maxLength={120} required />
            <FieldError message={fieldErrors.owner} />
          </label>
          <label>
            Attachment
            <input
              name="attachment"
              type="file"
              accept=".pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.csv,.yaml,.yml,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return setFileNote("");
                // Warn before submitting rather than after a rejected upload.
                setFileNote(
                  file.size > MAX_ATTACHMENT_BYTES
                    ? `${file.name} is ${formatBytes(file.size)} — over the 10 MB limit.`
                    : `${file.name} · ${formatBytes(file.size)}`
                );
              }}
            />
            <small>Optional · up to 10 MB</small>
            {fileNote && <small>{fileNote}</small>}
            <FieldError message={fieldErrors.attachment} />
          </label>
        </>
      )}

      {type === "assessments" && (
        <>
          <label>
            Engineer
            <input name="engineer" maxLength={120} required />
            <FieldError message={fieldErrors.engineer} />
          </label>
          <label>
            Skill
            <input
              name="skill"
              placeholder="e.g. High availability"
              maxLength={160}
              required
            />
            <FieldError message={fieldErrors.skill} />
          </label>
          <label>
            Rating
            <select name="rating">
              {SKILL_RATINGS.map((rating) => (
                <option key={rating}>{rating}</option>
              ))}
            </select>
            <FieldError message={fieldErrors.rating} />
          </label>
          <label>
            Delivery evidence
            <textarea name="evidence" maxLength={2000} required />
            <FieldError message={fieldErrors.evidence} />
          </label>
        </>
      )}
    </Modal>
  );
}
