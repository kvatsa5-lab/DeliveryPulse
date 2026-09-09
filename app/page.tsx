"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toasts } from "@/components/ui/Toasts";
import { TeamPulse } from "@/components/sections/TeamPulse";
import { MyWork } from "@/components/sections/MyWork";
import { Insights } from "@/components/sections/Insights";
import { RunbookLibrary } from "@/components/sections/RunbookLibrary";
import { Growth, Improvements } from "@/components/sections/OperatingSections";
import { UpdateModal } from "@/components/modals/UpdateModal";
import { EngagementModal } from "@/components/modals/EngagementModal";
import { OperatingModal } from "@/components/modals/OperatingModal";
import { useDeliveryData } from "@/hooks/useDeliveryData";
import { useToasts } from "@/hooks/useToasts";
import { ApiError, send } from "@/lib/api-client";
import type { OperatingRecordType } from "@/types/operating";

export default function Home() {
  const data = useDeliveryData();
  const { toasts, success, error, dismiss } = useToasts();

  const [section, setSection] = useState("Team pulse");
  const [updateFor, setUpdateFor] = useState<number | null>(null);
  const [newEngagement, setNewEngagement] = useState(false);
  const [operatingForm, setOperatingForm] = useState<OperatingRecordType | null>(null);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Single submit path for every mutation: manages the in-flight flag, maps an
   * ApiError's `fields` map onto inline messages, and reloads on success.
   */
  async function submit(
    action: () => Promise<unknown>,
    successMessage: string,
    onDone?: () => void
  ) {
    setPending(true);
    setFieldErrors({});
    try {
      await action();
      success(successMessage);
      onDone?.();
      await data.reload();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fields);
        error(caught.message);
      } else {
        error("Something went wrong. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  function openWeeklyUpdate(engagementId?: number) {
    if (!data.engagements.length) {
      error("Create an engagement before submitting a weekly update.");
      return;
    }
    setFieldErrors({});
    setUpdateFor(engagementId ?? data.engagements[0].id);
  }

  // A failed engagements fetch means no workspace access — nothing else renders.
  if (data.fatalError && !data.loading) {
    return (
      <main className="app">
        <section className="body">
          <section className="panel empty">
            <p className="label">DELIVERY PULSE</p>
            <h2>We could not open this workspace.</h2>
            <p>{data.fatalError}</p>
            <button type="button" className="primary" onClick={() => void data.reload()}>
              Try again
            </button>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <Sidebar
        section={section}
        onSelect={setSection}
        memberEmail={data.member?.email}
        memberRole={data.member?.role}
      />

      <section className="body">
        <header>
          <div>
            <p className="label">PILOT WORKSPACE</p>
            <h1>
              {section === "Team pulse" ? "Your team, clearly in motion." : section}
            </h1>
          </div>
          <div>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setFieldErrors({});
                setNewEngagement(true);
              }}
            >
              + Engagement
            </button>
            <button type="button" className="primary" onClick={() => openWeeklyUpdate()}>
              + Weekly update
            </button>
          </div>
        </header>

        <Toasts toasts={toasts} dismiss={dismiss} />

        {section === "Team pulse" && (
          <TeamPulse
            engagements={data.engagements}
            loading={data.loading}
            onOpenSection={setSection}
          />
        )}

        {section === "My work" && (
          <MyWork
            engagements={data.engagements}
            loading={data.loading}
            memberEmail={data.member?.email}
            onUpdate={openWeeklyUpdate}
          />
        )}

        {section === "Insights" && (
          <Insights engagements={data.engagements} runbooks={data.runbooks} />
        )}

        {section === "Runbook library" && (
          <RunbookLibrary
            runbooks={data.runbooks}
            loading={data.loading}
            canApprove={data.member?.canApprove ?? false}
            onAdd={() => {
              setFieldErrors({});
              setOperatingForm("runbooks");
            }}
            onApprove={(id, approval) =>
              void submit(
                () => send(`/api/operating?type=runbooks&id=${id}`, { approval }, "PATCH"),
                approval === "Approved"
                  ? "Runbook approved and published to the library."
                  : "Runbook sent back for review."
              )
            }
            onDelete={(id) => {
              if (!window.confirm("Delete this runbook and its attachment?")) return;
              void submit(
                () =>
                  send(`/api/operating?type=runbooks&id=${id}`, undefined, "DELETE"),
                "Runbook removed."
              );
            }}
          />
        )}

        {section === "Improvements" && (
          <Improvements
            improvements={data.improvements}
            loading={data.loading}
            onAdd={() => {
              setFieldErrors({});
              setOperatingForm("improvements");
            }}
          />
        )}

        {section === "Growth" && (
          <Growth
            assessments={data.assessments}
            loading={data.loading}
            onAdd={() => {
              setFieldErrors({});
              setOperatingForm("assessments");
            }}
          />
        )}
      </section>

      {updateFor !== null && (
        <UpdateModal
          engagements={data.engagements}
          initialId={updateFor}
          pending={pending}
          fieldErrors={fieldErrors}
          onClose={() => setUpdateFor(null)}
          onSubmit={(payload) =>
            void submit(
              () => send("/api/updates", payload),
              "Weekly update submitted. Your team pulse is current.",
              () => setUpdateFor(null)
            )
          }
        />
      )}

      {newEngagement && (
        <EngagementModal
          pending={pending}
          fieldErrors={fieldErrors}
          onClose={() => setNewEngagement(false)}
          onSubmit={(payload) =>
            void submit(
              () => send("/api/engagements", payload),
              "Engagement created and ready for its first weekly update.",
              () => setNewEngagement(false)
            )
          }
        />
      )}

      {operatingForm && (
        <OperatingModal
          type={operatingForm}
          pending={pending}
          fieldErrors={fieldErrors}
          onClose={() => setOperatingForm(null)}
          onSubmit={(form) =>
            void submit(
              () => send("/api/operating", form),
              operatingForm === "runbooks"
                ? "Runbook saved and queued for approval."
                : "Saved to the operating record.",
              () => setOperatingForm(null)
            )
          }
        />
      )}
    </main>
  );
}
