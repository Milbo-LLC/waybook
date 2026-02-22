import { Card } from "@waybook/ui";
import type { WaybookDTO } from "@waybook/contracts";
import Link from "next/link";

export const WaybookCard = ({ waybook }: { waybook: WaybookDTO }) => {
  return (
    <Card className="wb-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="wb-title text-xl">{waybook.title}</h3>
          <p className="wb-muted mt-1 text-sm">{waybook.startDate} to {waybook.endDate}</p>
        </div>
        <Link className="wb-btn-secondary !px-3 !py-1.5 text-xs" href={`/app/waybooks/${waybook.id}`}>
          Open
        </Link>
      </div>
      {waybook.description ? <p className="wb-muted mt-3 text-sm">{waybook.description}</p> : null}
    </Card>
  );
};
