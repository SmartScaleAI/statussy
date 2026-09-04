/**
 * Copied from 21st.dev Course Design Cards (kristen17).
 * https://21st.dev/@kristen17/components/course-design-cards
 * Source file: https://cdn.21st.dev/larsen66/course-design-cards/code.1753891438710.tsx
 *
 * Small Statussy adaptations (SMA-9 / SMA-12): optional official-status href,
 * no fake “add teammate” control. Header menu replaced with a local favorite
 * star. Footer is a compact text link (underline on hover/press).
 */
"use client"

import { ArrowUpRightIcon, StarIcon } from "lucide-react"
import Link from "next/link"
import React, { useState } from "react"

export interface CardData {
  id: number | string
  colorClass: string
  date?: string
  title: string
  description?: string
  /** Board uptime chicklet (SMA-31); omitted until live data exists. */
  uptimeLabel?: string
  /** Tooltip clarifying the uptime heuristic (not a vendor SLA). */
  uptimeTitle?: string
  /** Measured probe latency (SMA-23); omitted when there is no measurement. */
  latencyLabel?: string
  /** Tooltip clarifying the latency source (our probe, not the vendor). */
  latencyTitle?: string
  /** Latest snapshot is stale (failed fetch or past freshness threshold). */
  stale?: boolean
  imgSrc1?: string
  imgAlt1?: string
  imgSrc2?: string
  imgAlt2?: string
  countdownText: string
  countdownHref?: string
  /** Internal deep-dive route (SMA-17); wraps the logo + title in a link. */
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
      onClick={() => setFavorited((on) => !on)}
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
    uptimeLabel,
    uptimeTitle,
    latencyLabel,
    latencyTitle,
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

  const identity = (
    <>
      {imgSrc1 ? (
        // Decorative when alt is empty — title is already on the card.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="card-logo"
          src={imgSrc1}
          alt={imgAlt1 || ""}
          data-provider={data.id}
        />
      ) : null}
      <h3>{title}</h3>
    </>
  )

  return (
    <div className={`card ${colorClass}`}>
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
        {detailHref ? (
          <Link
            href={detailHref}
            className="card-detail-link"
            aria-label={`${title} status details`}
          >
            {identity}
          </Link>
        ) : (
          identity
        )}
        {description ? <p>{description}</p> : null}
        {/* Sparkline removed until a real history UI exists (SMA-18). */}
        <div className="metric-chicklets">
          <div
            className="uptime-chicklet"
            aria-label="Uptime"
            title={uptimeTitle}
          >
            <span className="status-metric-label">Uptime</span>
            {uptimeLabel ?? "—"}
          </div>
          {latencyLabel ? (
            // Second chicklet (SMA-23): latency measured by our own probe,
            // clearly separate from the official vendor status above.
            <div
              className="uptime-chicklet"
              aria-label="Measured latency"
              title={latencyTitle}
            >
              <span className="status-metric-label">Latency</span>
              {latencyLabel}
            </div>
          ) : null}
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
        {countdownHref ? (
          <a
            href={countdownHref}
            className="btn-countdown"
            target="_blank"
            rel="noreferrer"
          >
            {countdownText}
            <ArrowUpRightIcon aria-hidden="true" />
          </a>
        ) : (
          <a href="#" className="btn-countdown">
            {countdownText}
            <ArrowUpRightIcon aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  )
}

export default Card
