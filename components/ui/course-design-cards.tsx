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

export interface CardData {
  id: number | string
  colorClass: string
  date: string
  title: string
  description: string
  progressPercent: string
  progressValue: string
  imgSrc1?: string
  imgAlt1?: string
  imgSrc2?: string
  imgAlt2?: string
  countdownText: string
  countdownHref?: string
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
    progressPercent,
    progressValue,
    imgSrc1,
    imgAlt1,
    imgSrc2,
    imgAlt2,
    countdownText,
    countdownHref,
  } = data

  return (
    <div className={`card ${colorClass}`}>
      <div className="card-header">
        <div className="date">{date}</div>
        <EllipsisIcon />
      </div>
      <div className="card-body">
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="progress">
          <span>Progress</span>
          <div
            className="progress-bar"
            style={{ ["--progress" as string]: progressPercent }}
          />
          <span>{progressValue}</span>
        </div>
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
