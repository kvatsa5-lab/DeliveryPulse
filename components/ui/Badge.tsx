/** Status pill. The class name is derived so globals.css can colour each state. */
export function Badge({ status }: { status: string }) {
  const modifier = status.toLowerCase().replaceAll(" ", "-").replaceAll("/", "");
  return <span className={`status ${modifier}`}>{status}</span>;
}
