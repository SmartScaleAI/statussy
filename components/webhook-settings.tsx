"use client"

import { useState } from "react"

import {
  saveMyWebhookUrl,
  sendMyWebhookTest,
  setMyWebhookEnabled,
} from "@/app/actions/webhook-prefs"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { pickWebhookPrefs, type UserWebhookPrefs } from "@/lib/webhook-prefs"

export function WebhookSettings({
  initialPrefs,
  onSignedOut,
}: {
  initialPrefs: UserWebhookPrefs
  onSignedOut: () => void
}) {
  const [prefs, setPrefs] = useState<UserWebhookPrefs>(initialPrefs)
  const [url, setUrl] = useState(initialPrefs.url)
  const [uiEnabled, setUiEnabled] = useState(initialPrefs.enabled)
  const [pending, setPending] = useState<"save" | "enable" | "test" | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const busy = pending !== null
  const fieldsOpen = uiEnabled

  function applyPrefs(next: UserWebhookPrefs) {
    const picked = pickWebhookPrefs(next)
    setPrefs(picked)
    setUrl(picked.url)
    setUiEnabled(picked.enabled)
  }

  async function persistEnabled(enabled: boolean) {
    const result = await setMyWebhookEnabled(enabled)
    if (!result.signedIn) {
      onSignedOut()
      return null
    }
    applyPrefs(result)
    if (result.error) {
      setError(result.error)
      return null
    }
    return result
  }

  async function persistUrl() {
    const result = await saveMyWebhookUrl(url)
    if (!result.signedIn) {
      onSignedOut()
      return null
    }
    if (result.error) {
      applyPrefs(result)
      setError(result.error)
      return null
    }
    const picked = pickWebhookPrefs(result)
    setPrefs(picked)
    setUrl(picked.url)
    return result
  }

  async function onToggleEnabled(enabled: boolean) {
    setError(null)
    setNotice(null)
    if (!enabled) {
      setUiEnabled(false)
      if (!prefs.url && !prefs.hasSecret) {
        return
      }
      setPending("enable")
      const result = await persistEnabled(false)
      setPending(null)
      if (result) {
        setNotice("Webhook URL is saved and alerts are off.")
      }
      return
    }

    setUiEnabled(true)
    if (!prefs.url) {
      setNotice("Add a webhook URL and save it to start sending alerts.")
      return
    }
    setPending("enable")
    const result = await persistEnabled(true)
    setPending(null)
    if (result) {
      setNotice("Webhook alerts are on. Send a test to confirm delivery.")
    }
  }

  async function onSave() {
    setError(null)
    setNotice(null)
    setPending("save")
    const saved = await persistUrl()
    if (!saved) {
      setPending(null)
      setUiEnabled(true)
      return
    }
    const enabled = await persistEnabled(true)
    setPending(null)
    if (enabled) {
      setNotice("Webhook URL saved. Alerts are on.")
    } else {
      setUiEnabled(true)
    }
  }

  async function onTest() {
    setError(null)
    setNotice(null)
    if (url.trim() && url.trim() !== prefs.url) {
      setPending("save")
      const saved = await persistUrl()
      if (!saved) {
        setPending(null)
        setUiEnabled(true)
        return
      }
      if (uiEnabled) {
        const enabled = await persistEnabled(true)
        if (!enabled) {
          setPending(null)
          return
        }
      }
    }
    setPending("test")
    const result = await sendMyWebhookTest()
    setPending(null)
    if (!result.signedIn) {
      onSignedOut()
      return
    }
    applyPrefs(result)
    if (!result.ok) {
      setError(result.error || "Could not send a test webhook.")
      return
    }
    setNotice("Test webhook sent. Check your endpoint.")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook alerts</CardTitle>
        <CardDescription>
          Optional HTTPS POST when a starred service flips Major or Partial.
          Same toggles and mute-until-Live as email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {prefs.disabledNote ? (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="status"
            >
              {prefs.disabledNote}
            </p>
          ) : null}
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="webhook-enabled">Enable webhook</FieldLabel>
              <FieldDescription>
                Unlock the URL field. Alerts only send after a URL is saved.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="webhook-enabled"
              checked={uiEnabled}
              disabled={busy}
              onCheckedChange={(checked) => {
                void onToggleEnabled(checked)
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="webhook-url">Webhook URL</FieldLabel>
            <Input
              id="webhook-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://example.com/webhook"
              value={url}
              disabled={!fieldsOpen || busy}
              onChange={(event) => {
                setUrl(event.target.value)
              }}
            />
            <FieldDescription>
              Public HTTPS endpoint. Statussy signs each POST for you.
            </FieldDescription>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!fieldsOpen || busy}
              onClick={() => {
                void onSave()
              }}
            >
              {pending === "save" ? "Saving…" : "Save URL"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!fieldsOpen || busy || (!prefs.url && !url.trim())}
              onClick={() => {
                void onTest()
              }}
            >
              {pending === "test" ? "Sending…" : "Send test"}
            </Button>
          </div>
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              How outbound webhooks work
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Turn on Enable webhook and save a public HTTPS URL.</li>
              <li>
                When a starred service newly enters Major or Partial, Statussy
                POSTs one JSON payload for that poll.
              </li>
              <li>
                The body includes a short text summary and a services array with
                ids, names, statuses, and links.
              </li>
              <li>
                Statussy generates a signing secret and adds an
                X-Statussy-Signature HMAC on every POST. You do not create or
                manage a secret.
              </li>
            </ol>
          </details>
          {notice ? (
            <p className="text-sm text-muted-foreground" role="status">
              {notice}
            </p>
          ) : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
