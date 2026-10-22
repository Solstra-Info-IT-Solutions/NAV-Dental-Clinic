import type { Metadata } from "next";
import Link from "next/link";

import { ClosureForm, DeleteBlockButton, DeleteClosureButton, SlotBlockForm } from "@/components/admin/schedule-forms";
import { AdminPageHeader, Panel, StatusBadge, Table, td, th } from "@/components/admin/ui";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { getScheduleDay, listClosures } from "@/features/schedule/service";
import { requireAdminPage } from "@/lib/auth/guards";
import { addDays, formatLocalDate, isValidLocalDate, toLocalDate } from "@/lib/time/ist";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: PageProps<"/admin/schedule">) {
  const { admin } = await requireAdminPage("staff");
  const requested = (await searchParams).date;
  const today = toLocalDate(new Date());
  const date = typeof requested === "string" && isValidLocalDate(requested) ? requested : today;
  const [day, closures] = await Promise.all([getScheduleDay(date), listClosures(today)]);

  const times = [...new Set(day.cells.map((c) => c.start))];
  const chairs = Array.from({ length: day.capacity }, (_, i) => `chair-${i + 1}`);
  const cellAt = (start: string, chair: string) => day.cells.find((c) => c.start === start && c.resourceKey === chair);

  return (
    <>
      <AdminPageHeader title="Schedule" description="One day at a time. Block times for meetings or breaks, and add holidays or closures." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/admin/schedule?date=${addDays(date, -1)}`} className="inline-flex min-h-11 items-center rounded-md border border-silver-200 bg-white px-3">
          ← Previous day
        </Link>
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="schedule-date" className="sr-only">
            Date
          </label>
          <input id="schedule-date" type="date" name="date" defaultValue={date} className="min-h-11 rounded-sm border border-steel-400 bg-white px-3" />
          <button type="submit" className="min-h-11 rounded-md bg-ink-900 px-4 font-semibold text-platinum-100">
            Go
          </button>
        </form>
        <Link href={`/admin/schedule?date=${addDays(date, 1)}`} className="inline-flex min-h-11 items-center rounded-md border border-silver-200 bg-white px-3">
          Next day →
        </Link>
        {date !== today ? (
          <Link href="/admin/schedule" className="underline">
            Today
          </Link>
        ) : null}
      </div>

      <Panel title={formatLocalDate(new Date(`${date}T06:30:00.000Z`))}>
        {day.closedAllDay && day.cells.length === 0 ? (
          <EmptyState title="Closed">{day.closures.length ? "A closure covers this day." : "No opening hours are set for this weekday."}</EmptyState>
        ) : (
          <>
            {day.closures.length > 0 ? <Alert kind="info" title="A closure applies to part or all of this day." className="mb-4" /> : null}
            <Table caption={`Schedule for ${date}`}>
              <thead>
                <tr>
                  <th className={th}>Time</th>
                  {chairs.map((c) => (
                    <th key={c} className={th}>
                      {c.replace("chair-", "Chair ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {times.map((start) => (
                  <tr key={start}>
                    <th scope="row" className={`${td} whitespace-nowrap font-medium`}>
                      {day.cells.find((c) => c.start === start)?.label}
                    </th>
                    {chairs.map((chair) => {
                      const cell = cellAt(start, chair);
                      if (!cell) return <td key={chair} className={td} />;
                      return (
                        <td key={chair} className={`${td} ${cell.state === "free" ? "text-graphite-500" : ""}`}>
                          {cell.state === "appointment" && cell.appointment ? (
                            <span className="flex flex-wrap items-center gap-2">
                              <Link href={`/admin/appointments/${cell.appointment.id}`} className="font-medium underline">
                                {cell.appointment.patientName}
                              </Link>
                              <StatusBadge status={cell.appointment.status} />
                            </span>
                          ) : cell.state === "block" && cell.block ? (
                            <span className="flex flex-wrap items-center gap-2">
                              <span>Blocked: {cell.block.reason}</span>
                              <DeleteBlockButton id={cell.block.id} />
                            </span>
                          ) : cell.state === "closed" ? (
                            "Closed"
                          ) : (
                            "Free"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Block time">
          <SlotBlockForm date={date} capacity={day.capacity} />
        </Panel>
        <Panel title="Holidays and closures">
          {closures.length === 0 ? (
            <p className="mb-4 text-sm text-graphite-600">No upcoming closures.</p>
          ) : (
            <ul className="mb-6 divide-y divide-silver-200">
              {closures.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">
                      {c.startDate === c.endDate ? c.startDate : `${c.startDate} – ${c.endDate}`}
                      {c.allDay ? "" : ` (${c.startTime}–${c.endTime})`}
                    </span>
                    <span className="block text-sm text-graphite-600">{c.reason}</span>
                  </span>
                  {admin.role === "owner" ? <DeleteClosureButton id={c.id} /> : null}
                </li>
              ))}
            </ul>
          )}
          {admin.role === "owner" ? <ClosureForm /> : <p className="text-sm text-graphite-600">Only the owner can add or remove closures.</p>}
        </Panel>
      </div>
    </>
  );
}
