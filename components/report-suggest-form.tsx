"use client"

import { useActionState, useEffect, useRef, useState } from "react"

import { submitReportSuggest } from "@/app/actions/report-suggest"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  FORM_KIND_LABELS,
  FORM_KINDS,
  MAX_DESCRIPTION_LENGTH,
  MAX_SERVICE_LENGTH,
  initialReportSuggestState,
  type FormKind,
} from "@/lib/user-report"

const selectClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
  "md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
  "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
)

export function ReportSuggestForm({
  serviceNames,
}: {
  serviceNames: string[]
}) {
  const { isSignedIn } = useAuth()
  const formRef = useRef<HTMLFormElement>(null)
  const [kind, setKind] = useState<FormKind>("suggest_service")
  const [state, action, pending] = useActionState(
    submitReportSuggest,
    initialReportSuggestState
  )
  const isSuggest = kind === "suggest_service"

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset()
      setKind("suggest_service")
    }
  }, [state])

  return (
    <form
      ref={formRef}
      action={action}
      className="relative flex flex-col gap-3"
    >
      <FieldSet>
        <FieldLegend>Report or suggest</FieldLegend>
        <FieldDescription>
          {isSuggest
            ? "Know a service we should track? Name is required; email is optional."
            : "Tell us what looks wrong. Description is required; service is optional."}
        </FieldDescription>
        <div aria-hidden="true" className="sr-only">
          <label htmlFor="report-website">Website</label>
          <input
            id="report-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <FieldGroup className="gap-3">
          <Field data-invalid={!!state.fieldErrors?.kind || undefined}>
            <FieldLabel htmlFor="report-kind">Type</FieldLabel>
            <select
              id="report-kind"
              name="kind"
              required
              disabled={pending}
              value={kind}
              aria-invalid={!!state.fieldErrors?.kind || undefined}
              className={selectClassName}
              onChange={(event) => {
                const next = event.target.value
                if (FORM_KINDS.includes(next as FormKind)) {
                  setKind(next as FormKind)
                }
              }}
            >
              {FORM_KINDS.map((value) => (
                <option key={value} value={value}>
                  {FORM_KIND_LABELS[value]}
                </option>
              ))}
            </select>
            <FieldError>{state.fieldErrors?.kind}</FieldError>
          </Field>

          {isSuggest ? (
            <Field data-invalid={!!state.fieldErrors?.name || undefined}>
              <FieldLabel htmlFor="report-name">Name</FieldLabel>
              <Input
                id="report-name"
                name="name"
                type="text"
                required
                maxLength={120}
                autoComplete="off"
                disabled={pending}
                aria-invalid={!!state.fieldErrors?.name || undefined}
                placeholder="Service name"
              />
              <FieldError>{state.fieldErrors?.name}</FieldError>
            </Field>
          ) : (
            <>
              <Field
                data-invalid={!!state.fieldErrors?.description || undefined}
              >
                <FieldLabel htmlFor="report-description">
                  Description
                </FieldLabel>
                <Textarea
                  id="report-description"
                  name="description"
                  required
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  disabled={pending}
                  aria-invalid={!!state.fieldErrors?.description || undefined}
                  placeholder="What should we look at?"
                  rows={4}
                />
                <FieldError>{state.fieldErrors?.description}</FieldError>
              </Field>
              <Field data-invalid={!!state.fieldErrors?.service || undefined}>
                <FieldLabel htmlFor="report-service">
                  Service{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FieldLabel>
                <Input
                  id="report-service"
                  name="service"
                  type="text"
                  maxLength={MAX_SERVICE_LENGTH}
                  autoComplete="off"
                  list="report-service-list"
                  disabled={pending}
                  aria-invalid={!!state.fieldErrors?.service || undefined}
                  placeholder="Pick or type a name"
                />
                <datalist id="report-service-list">
                  {serviceNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <FieldError>{state.fieldErrors?.service}</FieldError>
              </Field>
            </>
          )}

          {!isSignedIn ? (
            <Field data-invalid={!!state.fieldErrors?.email || undefined}>
              <FieldLabel htmlFor="report-email">
                Email{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLabel>
              <Input
                id="report-email"
                name="email"
                type="email"
                maxLength={254}
                autoComplete="email"
                disabled={pending}
                aria-invalid={!!state.fieldErrors?.email || undefined}
                placeholder="you@example.com"
              />
              <FieldError>{state.fieldErrors?.email}</FieldError>
            </Field>
          ) : null}

          <Field>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Sending…" : isSuggest ? "Suggest" : "Send report"}
            </Button>
          </Field>
        </FieldGroup>
      </FieldSet>
      {state.status === "success" ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" && !state.fieldErrors ? (
        <FieldError>{state.message}</FieldError>
      ) : null}
    </form>
  )
}
