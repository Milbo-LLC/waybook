import { Card } from "@waybook/ui";
import type { EntryDTO } from "@waybook/contracts";

export const EntryList = ({ entries }: { entries: EntryDTO[] }) => {
  if (!entries.length) {
    return <Card>No entries yet.</Card>;
  }

  return (
    <div className="grid gap-3">
      {entries.map((entry) => (
        <Card key={entry.id}>
          <p className="text-sm text-slate-500">{new Date(entry.capturedAt).toLocaleString()}</p>
          {entry.textContent ? <p className="mt-2 text-sm">{entry.textContent}</p> : null}
          {entry.location ? (
            <p className="mt-2 text-xs text-slate-500">
              {entry.location.placeName ?? "Pinned location"} ({entry.location.lat.toFixed(4)}, {entry.location.lng.toFixed(4)})
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
};
