/**
 * Copied from 21st.dev Course Design Cards (kristen17).
 * https://21st.dev/@kristen17/components/course-design-cards
 * Source file: https://cdn.21st.dev/larsen66/course-design-cards/code.1753891438710.tsx
 *
 * Small Statussy adaptations (SMA-9): optional official-status href, progress
 * width from `progressPercent` instead of theme-hardcoded 90/30/50/20, no
 * fake “add teammate” control. Ellipsis path completed (upstream was truncated).
 */
import { ArrowUpRightIcon } from "lucide-react"
import React from "react"

import {
  historySparkline,
  STATUS_HISTORY_DAYS,
  type ServiceStatus,
} from "@/lib/status"

export interface CardData {
  id: number | string
  colorClass: string
  date?: string
  title: string
  description: string
  history?: ServiceStatus[]
  uptimeLabel?: string
  latencyLabel?: string
  imgSrc1?: string
  imgAlt1?: string
  imgSrc2?: string
  imgAlt2?: string
  countdownText: string
  countdownHref?: string
  statusLabel?: string
}

function StatusSparkline({
  history,
  fadeId,
}: {
  history: ServiceStatus[]
  fadeId: string
}) {
  const spark = historySparkline(history)
  const gradientId = `spark-fade-${fadeId}`

  return (
    <div className="status-sparkline-wrap">
      <svg
        className="status-sparkline"
        viewBox={`0 0 ${spark.width} ${spark.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop className="spark-fade-start" offset="0%" />
            <stop className="spark-fade-end" offset="100%" />
          </linearGradient>
        </defs>
        <path
          className="spark-fill"
          d={spark.area}
          fill={`url(#${gradientId})`}
        />
        <path className="spark-line" d={spark.line} />
      </svg>
      <span
        className="spark-today"
        style={{
          left: `${(spark.endX / spark.width) * 100}%`,
          top: `${(spark.endY / spark.height) * 100}%`,
        }}
        title="Today"
      />
    </div>
  )
}

interface CardProps {
  data: CardData
}

const EllipsisIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="size-6"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0"
      clipRule="evenodd"
    />
  </svg>
)

const Card: React.FC<CardProps> = ({ data }) => {
  const {
    colorClass,
    date,
    title,
    description,
    history,
    uptimeLabel,
    latencyLabel,
    imgSrc1,
    imgAlt1,
    imgSrc2,
    imgAlt2,
    countdownText,
    countdownHref,
    statusLabel,
  } = data

  return (
    <div className={`card ${colorClass}`}>
      <div className="card-header">
        <div className="status-live">
          <span className="status-dot" aria-hidden="true" />
          {statusLabel ?? date}
        </div>
        <EllipsisIcon />
      </div>
      <div className="card-body">
        <h3>{title}</h3>
        <p>{description}</p>
        {history && history.length > 0 ? (
          <div
            className="status-history"
            aria-label={`${STATUS_HISTORY_DAYS}-day status history`}
          >
            <StatusSparkline fadeId={String(data.id)} history={history} />
            <div className="status-history-meta">
              {latencyLabel ? (
                <span>
                  <span className="status-metric-label">Latency</span>
                  {latencyLabel}
                </span>
              ) : null}
              {uptimeLabel ? (
                <span>
                  <span className="status-metric-label">Uptime</span>
                  {uptimeLabel}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <div className="card-footer">
        <ul>
          {imgSrc1 && (
            <li>
              {/* Decorative when alt is empty — title is already on the card. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc1} alt={imgAlt1 || ""} />
            </li>
          )}
          {imgSrc2 && (
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc2} alt={imgAlt2 || ""} />
            </li>
          )}
        </ul>
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
