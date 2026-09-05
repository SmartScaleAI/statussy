/**
 * Copied from 21st.dev Course Design Cards (kristen17).
 * https://21st.dev/@kristen17/components/course-design-cards
 * Source file: https://cdn.21st.dev/larsen66/course-design-cards/code.1753891438710.tsx
 *
 * Small Statussy adaptations (SMA-9 / SMA-12): no fake “add teammate”
 * control. Header menu replaced with a local favorite star.
 *
 * SMA-33: the whole card is the detail hit target (stretched overlay link).
 * Star sits above it and stopPropagation so it stays usable.
 * SMA-36: shelf has no divider; “click to view” is affordance only
 * (no outbound official-status link).
 */
"use client"

import { ArrowUpRightIcon, StarIcon } from "lucide-react"
import Link from "next/link"
import React, { useState, type MouseEvent } from "react"

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
   * Live Health % from current components (SMA-31); omitted until live
   * data exists. This is a live snapshot, not historical uptime.
   */
  healthLabel?: string
  /** Latest snapshot is stale (failed fetch or past freshness threshold). */
  stale?: boolean
  imgSrc1?: string
  imgAlt1?: string
  imgSrc2?: string
  imgAlt2?: string
  countdownText: string
  /** Internal deep-dive route (SMA-17 / SMA-33); whole-card hit target. */
  detailHref?: string
  statusLabel?: string
  updatedAt?: string
  updatedLabel?: string
}

interface CardProps {
  data: CardData
}

function FavoriteButton() {
  const [favorited, setFavorited] = useState(false)

  return (
    <button
      type="button"
      className={favorited ? "btn-favorite is-favorited" : "btn-favorite"}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      onClick={(event) => {
        event.preventDefault()
        stopCardNavigation(event)
        setFavorited((on) => !on)
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
    healthLabel,
    stale,
    imgSrc1,
    imgAlt1,
    countdownText,
    detailHref,
    statusLabel,
    updatedAt,
    updatedLabel,
  } = data

  const identity = (
    <>
      {imgSrc1 ? (
        // Decorative when alt is empty — title is already on the card.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="card-logo"
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
      {detailHref ? (
        <Link
          href={detailHref}
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
        <FavoriteButton />
      </div>
      <div className="card-body">
        <div className="card-identity">{identity}</div>
        {description ? <p>{description}</p> : null}
        {/* Sparkline removed until a real history UI exists (SMA-18). */}
        <div className="metric-chicklets">
          <div
            className="health-chicklet"
            aria-label="Live health, current components"
            title="Live component health — not historical uptime"
          >
            <span className="status-metric-label">Health</span>
            {healthLabel ?? "—"}
          </div>
        </div>
      </div>
      <div className="card-footer">
        {updatedLabel ? (
          <time
            className="updated-at"
            dateTime={updatedAt}
            title={updatedAt}
          >
            {updatedLabel}
          </time>
        ) : (
          <span />
        )}
        {detailHref ? (
          <Link href={detailHref} className="btn-countdown">
            {countdownText}
            <ArrowUpRightIcon aria-hidden="true" />
          </Link>
        ) : (
          <span className="btn-countdown">
            {countdownText}
            <ArrowUpRightIcon aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  )
}

export default Card
