import { Card } from "@waybook/ui";
import type { WaybookDTO } from "@waybook/contracts";
import Link from "next/link";
import { formatTripDateRange } from "@/lib/dates";

export const WaybookCard = ({ waybook }: { waybook: WaybookDTO }) => {
  return (
    <Link className="block" href={`/app/waybooks/${waybook.id}`}>
      <Card className="wb-surface p-5 transition hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="wb-title text-xl">{waybook.title}</h3>
            <p className="wb-muted mt-1 text-sm">
              {formatTripDateRange(
                waybook.startDate,
                waybook.endDate,
                waybook.timeframeLabel,
                waybook.earliestStartDate,
                waybook.latestEndDate
              )}
            </p>
          </div>
        </div>
        {waybook.description ? <p className="wb-muted mt-3 text-sm">{waybook.description}</p> : null}
      </Card>
    </Link>
  );
};
