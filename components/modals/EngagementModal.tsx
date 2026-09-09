"use client";

import { Modal, ModalActions, FieldError } from "@/components/ui/Modal";
import { ARCHITECTURES, ENVIRONMENTS } from "@/lib/constants/statuses";

export function EngagementModal({
  onClose,
  onSubmit,
  pending,
  fieldErrors,
}: {
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  pending: boolean;
  fieldErrors: Record<string, string>;
}) {
  return (
    <Modal
      label="NEW ENGAGEMENT"
      title="Add an engagement"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        const entries = Object.fromEntries(new FormData(event.currentTarget));
        onSubmit(
          Object.fromEntries(
            Object.entries(entries).map(([key, value]) => [key, String(value)])
          )
        );
      }}
      footer={
        <ModalActions
          onCancel={onClose}
          submitLabel="Create engagement"
          pending={pending}
        />
      }
    >
      <label>
        Customer
        <input name="customer" maxLength={120} required />
        <FieldError message={fieldErrors.customer} />
      </label>

      <label>
        Work title
        <input
          name="title"
          placeholder="e.g. Nexus Repository HA deployment"
          maxLength={200}
          required
        />
        <FieldError message={fieldErrors.title} />
      </label>

      <label>
        Product(s)
        <input
          name="products"
          placeholder="Nexus Repository, IQ Server…"
          maxLength={200}
          required
        />
        <FieldError message={fieldErrors.products} />
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
        <select name="architecture">
          {ARCHITECTURES.map((architecture) => (
            <option key={architecture}>{architecture}</option>
          ))}
        </select>
        <FieldError message={fieldErrors.architecture} />
      </label>

      <label>
        Owner
        <input name="owner" placeholder="Engineer name" maxLength={120} required />
        <FieldError message={fieldErrors.owner} />
      </label>
    </Modal>
  );
}
