"use client";

import { NAV_ITEMS } from "@/lib/constants/statuses";

export function Sidebar({
  section,
  onSelect,
  memberEmail,
  memberRole,
}: {
  section: string;
  onSelect: (section: string) => void;
  memberEmail?: string;
  memberRole?: string;
}) {
  // Initials from the signed-in email, rather than a hard-coded "KV".
  const initials = (memberEmail ?? "")
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";

  const displayName = memberEmail
    ? memberEmail
        .split("@")[0]
        .split(/[._-]/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" ")
    : "Signed out";

  return (
    <aside>
      <div className="brand">
        <b aria-hidden="true">D</b>
        <span>
          Delivery
          <br />
          <strong>Pulse</strong>
        </span>
      </div>
      <p className="label">SOLUTION DELIVERY ENGINEERING</p>
      <nav aria-label="Sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            className={item === section ? "active" : ""}
            aria-current={item === section ? "page" : undefined}
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="user">
        <i aria-hidden="true">{initials}</i>
        <span>
          <strong>{displayName}</strong>
          <small>{memberRole ?? "No workspace role"}</small>
        </span>
      </div>
    </aside>
  );
}
