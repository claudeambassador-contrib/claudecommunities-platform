import { NextResponse } from "next/server";
import { withService } from "@/lib/services/_route";
import { getCoffeePoolStatus, requirePortalAdmin } from "@/lib/services/impactLab";

function csvEscape(v: string | null | undefined): string {
  const s = v ?? "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// CSV of the full coffee-code pool — for the venue to print and cross off
// as codes get redeemed at the cart.
export const GET = withService(async () => {
  await requirePortalAdmin();
  const pool = await getCoffeePoolStatus();

  const header = ["#", "Code", "Status", "Assigned to", "Team", "Redeemed at"];
  const rows = pool.codes.map((c) => {
    const status = c.participantId
      ? c.participant?.coffeeRedeemed
        ? "redeemed"
        : "assigned"
      : "unassigned";
    return [
      String(c.order),
      c.code,
      status,
      c.participant?.name ?? "",
      c.participant?.team?.name ?? "",
      c.participant?.coffeeRedeemedAt ? new Date(c.participant.coffeeRedeemedAt).toISOString() : "",
    ]
      .map(csvEscape)
      .join(",");
  });

  const csv = `${[header.join(","), ...rows].join("\r\n")}\r\n`;
  const filename = `impact-lab-coffee-codes-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
