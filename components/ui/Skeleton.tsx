/** Shimmer placeholder rows used while a collection is loading. */
export function SkeletonRows({
  rows = 4,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div className="tr" key={row}>
          {Array.from({ length: columns }, (_, column) => (
            <span key={column}>
              <span className="skeleton" />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="metrics" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article key={index}>
          <span className="skeleton skeleton-label" />
          <span className="skeleton skeleton-number" />
        </article>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className="record" key={index}>
          <span>
            <span className="skeleton" />
            <span className="skeleton skeleton-label" />
          </span>
        </div>
      ))}
    </div>
  );
}
