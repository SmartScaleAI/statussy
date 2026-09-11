/**
 * Copied from 21st.dev Course Design Cards (kristen17).
 * https://21st.dev/@kristen17/components/course-design-cards
 * Source file: https://cdn.21st.dev/larsen66/course-design-cards/code.1753891438710.tsx
 *
 * Small Statussy adaptations (SMA-9 / SMA-12): no fake “add teammate”
 * control. Header menu replaced with a local favorite star.
 *
 * SMA-33: the whole card is the detail hit target (stretched overlay link).
 * Star + Official status sit above it and stopPropagation so they stay usable.
 * SMA-129: Official control is quiet text `Official status ↗` (no extra icon).
 * SMA-36: shelf has no divider. Footer stamp is relative (`Checked 2m ago`).
 * SMA-37: star toggles localStorage favorites (`statussy:favoriteServiceIds`).
 * SMA-103: signed-out star opens the login dialog and does not toggle.
 */
"use client"

import { StarIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import React, { type MouseEvent } from "react"

import { useAuth } from "@/components/auth-provider"
import { useFavoriteServices } from "@/components/favorite-services"
import { CATEGORY_PARAM } from "@/lib/board-filter"
import { logoInvertClass } from "@/lib/light-logo-ids"
import { formatTimestamp } from "@/lib/status"
import { cn } from "@/lib/utils"

function stopCardNavigation(event: MouseEvent) {
  event.stopPropagation()
}

export interface CardData {
  id: number | string
  colorClass: string
  date?: string
  title: string
  description?: string
  /**
   * Health chicklet (SMA-31/SMA-79): "Health X%" from current components,
   * "N open" incident count, or "No incidents" for no-grid services. The
   * tooltip (`title`) must match the mode — it only claims component health
   * when a component grid exists.
   */
  chicklet?: {
    /** Slot prefix ("Health"); null in incident modes. */
    label: string | null
    value: string
    /** Tooltip + aria text. */
    title: string
  }
  /** Latest snapshot is stale (failed fetch or past freshness threshold). */
  stale?: boolean
  imgSrc1?: string
  imgAlt1?: string
  imgSrc2?: string
  imgAlt2?: string
  countdownText: string
  countdownHref?: string
  /** Internal deep-dive route (SMA-17 / SMA-33); whole-card hit target. */
  detailHref?: string
  statusLabel?: string
  updatedAt?: string
  updatedLabel?: string
}

interface CardProps {
  data: CardData
}

function FavoriteButton({ serviceId }: { serviceId: string }) {
  const { isFavorited, toggleFavorite } = useFavoriteServices()
  const { isPending, isSignedIn, openLogin } = useAuth()
  const favorited = isFavorited(serviceId)

  return (
    <button
      type="button"
      className={favorited ? "btn-favorite is-favorited" : "btn-favorite"}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      onClick={(event) => {
        event.preventDefault()
        stopCardNavigation(event)
        if (isPending) {
          return
        }
        if (!isSignedIn) {
          openLogin("favorites")
          return
        }
        toggleFavorite(serviceId)
      }}
    >
      <StarIcon aria-hidden="true" fill={favorited ? "currentColor" : "none"} />
    </button>
  )
}

const Card: React.FC<CardProps> = ({ data }) => {
  const {
    colorClass,
    date,
    title,
    description,
    chicklet,
    stale,
    imgSrc1,
    imgAlt1,
    countdownText,
    countdownHref,
    detailHref,
    statusLabel,
    updatedAt,
    updatedLabel,
  } = data

  const chickletDisplay = chicklet ?? {
    label: "Health",
    value: "—",
    title: "No live data for this service yet.",
  }

  // Carry the board's active category onto the detail route so its Back link
  // can restore the filter (SMA-89). The detail page validates the slug.
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get(CATEGORY_PARAM)
  const detailHrefWithCategory =
    detailHref && activeCategory
      ? `${detailHref}?${CATEGORY_PARAM}=${encodeURIComponent(activeCategory)}`
      : detailHref

  const identity = (
    <>
      {imgSrc1 ? (
        // Decorative when alt is empty — title is already on the card.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // SMA-93: white-on-transparent marks flip to black on light cards.
          className={cn("card-logo", logoInvertClass(String(data.id)))}
          src={imgSrc1}
          alt={imgAlt1 || ""}
          data-service={data.id}
        />
      ) : null}
      <h3>{title}</h3>
    </>
  )

  return (
    <div className={`card ${colorClass}`}>
      {detailHrefWithCategory ? (
        <Link
          href={detailHrefWithCategory}
          className="card-hit-target"
          aria-label={`${title} status details`}
        >
          <span className="sr-only">{title} status details</span>
        </Link>
      ) : null}
      <div className="card-header">
        <div className="status-live">
          <span className="status-dot" aria-hidden="true" />
          {statusLabel ?? date}
          {stale ? (
            <span
              className="stale-badge"
              title="Last fetch failed or data is out of date"
            >
              Stale
            </span>
          ) : null}
        </div>
        <FavoriteButton serviceId={String(data.id)} />
      </div>
      <div className="card-body">
        <div className="card-identity">{identity}</div>
        {description ? <p>{description}</p> : null}
        {/* Sparkline removed until a real history UI exists (SMA-18). */}
        <div className="metric-chicklets">
          <div
            className="health-chicklet"
            aria-label={chickletDisplay.title}
            title={chickletDisplay.title}
          >
            {chickletDisplay.label !== null ? (
              <span className="status-metric-label">
                {chickletDisplay.label}
              </span>
            ) : null}
            {chickletDisplay.value}
          </div>
        </div>
      </div>
      <div className="card-footer">
        {updatedLabel ? (
          <time
            className="updated-at"
            dateTime={updatedAt}
            title={updatedAt ? formatTimestamp(updatedAt) : undefined}
          >
            {updatedLabel}
          </time>
        ) : (
          <span />
        )}
        {countdownHref ? (
          <a
            href={countdownHref}
            className="btn-countdown"
            target="_blank"
            rel="noopener noreferrer"
            onClick={stopCardNavigation}
          >
            {countdownText}
          </a>
        ) : (
          <a
            href="#"
            className="btn-countdown"
            onClick={(event) => {
              event.preventDefault()
              stopCardNavigation(event)
            }}
          >
            {countdownText}
          </a>
        )}
      </div>
    </div>
  )
}

export default Card
