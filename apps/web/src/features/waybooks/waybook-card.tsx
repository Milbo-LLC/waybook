import { Card } from "@waybook/ui";
import type { WaybookDTO } from "@waybook/contracts";
import Link from "next/link";

export const WaybookCard = ({ waybook }: { waybook: WaybookDTO }) => {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{waybook.title}</h3>
          <p className="text-sm text-slate-600">{waybook.startDate} to {waybook.endDate}</p>
        </div>
        <Link className="text-sm font-medium text-brand-700" href={`/app/waybooks/${waybook.id}`}>
          Open
        </Link>
      </div>
      {waybook.description ? <p className="mt-2 text-sm text-slate-700">{waybook.description}</p> : null}
    </Card>
  );
};
