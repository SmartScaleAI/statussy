"use client"

import { useActionState, useEffect, useRef } from "react"

import {
  initialSuggestProviderState,
  suggestProvider,
} from "@/app/actions/suggest-provider"
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

export function SuggestProviderForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(
    suggestProvider,
    initialSuggestProviderState
  )

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form
      ref={formRef}
      action={action}
      className="relative flex flex-col gap-3 overflow-hidden"
    >
      <FieldSet>
        <FieldLegend>Suggest a Provider</FieldLegend>
        <FieldDescription>
          Know an AI service we should track? Name is required; email is
          optional.
        </FieldDescription>
        <div
          aria-hidden="true"
          className="absolute left-[-10000px] h-px w-px overflow-hidden"
        >
          <label htmlFor="suggest-website">Website</label>
          <input
            id="suggest-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <FieldGroup className="gap-3 sm:flex-row sm:items-end">
          <Field data-invalid={!!state.fieldErrors?.name || undefined}>
            <FieldLabel htmlFor="suggest-name">Name</FieldLabel>
            <Input
              id="suggest-name"
              name="name"
              type="text"
              required
              maxLength={120}
              autoComplete="off"
              disabled={pending}
              aria-invalid={!!state.fieldErrors?.name || undefined}
              placeholder="Provider name"
            />
            <FieldError>{state.fieldErrors?.name}</FieldError>
          </Field>
          <Field data-invalid={!!state.fieldErrors?.email || undefined}>
            <FieldLabel htmlFor="suggest-email">
              Email{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </FieldLabel>
            <Input
              id="suggest-email"
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
          <Field className="sm:w-auto">
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Suggest"}
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
