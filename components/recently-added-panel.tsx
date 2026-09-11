import Link from "next/link"

import { ServiceLogo } from "@/components/service-logo"
import {
  formatAddedDate,
  listRecentlyAddedServices,
} from "@/lib/recently-added"

/**
 * Recently added list (SMA-123). Same plain card chrome as Report/Suggest;
 * stacked above that form in the sticky rail.
 */
export async function RecentlyAddedPanel() {
  const items = await listRecentlyAddedServices()
  if (items.length === 0) {
    return null
  }

  return (
    <div className="course-design-board">
      <div className="card plain">
        <div className="suggest-card-body flex flex-col gap-3">
          <h2 className="font-medium text-base">Recently added</h2>
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/services/${item.id}`}
                  className="recently-added-row rounded-md px-1 py-1.5 text-sm text-foreground hover:bg-foreground/5"
                >
                  <ServiceLogo
                    id={item.id}
                    name={item.name}
                    className="size-4"
                  />
                  <span className="min-w-0 truncate">{item.name}</span>
                  <time
                    className="ml-auto shrink-0 text-xs text-muted-foreground"
                    dateTime={item.createdAt.toISOString()}
                  >
                    {formatAddedDate(item.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
