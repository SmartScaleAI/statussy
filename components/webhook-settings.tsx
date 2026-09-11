"use client"

import { useState } from "react"

import {
  revealMyWebhookSecret,
  rotateMyWebhookSecret,
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
  const [pending, setPending] = useState<
    "save" | "enable" | "test" | "rotate" | "reveal" | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [secretOnce, setSecretOnce] = useState<string | null>(null)
  const busy = pending !== null

  function applyPrefs(next: UserWebhookPrefs) {
    setPrefs(pickWebhookPrefs(next))
    setUrl(next.url)
  }

  async function onSave() {
    setError(null)
    setNotice(null)
    setPending("save")
    const result = await saveMyWebhookUrl(url)
    setPending(null)
    if (!result.signedIn) {
      onSignedOut()
      return
    }
    applyPrefs(result)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.secretOnce) {
      setSecretOnce(result.secretOnce)
      setNotice("Signing secret created. Copy it now. You can reveal it later.")
    } else {
      setNotice("Webhook URL saved. It stays off until you enable it.")
    }
  }

  async function onToggleEnabled(enabled: boolean) {
    setError(null)
    setNotice(null)
    if (enabled && url.trim() && url.trim() !== prefs.url) {
      setPending("save")
      const saved = await saveMyWebhookUrl(url)
      if (!saved.signedIn) {
        setPending(null)
        onSignedOut()
        return
      }
      applyPrefs(saved)
      if (saved.secretOnce) {
        setSecretOnce(saved.secretOnce)
      }
      if (saved.error) {
        setPending(null)
        setError(saved.error)
        return
      }
    }
    setPending("enable")
    const previous = prefs
    setPrefs({ ...prefs, enabled })
    const result = await setMyWebhookEnabled(enabled)
    setPending(null)
    if (!result.signedIn) {
      setPrefs(previous)
      onSignedOut()
      return
    }
    applyPrefs(result)
    if (result.error) {
      setError(result.error)
      return
    }
    setNotice(
      enabled
        ? "Webhook alerts are on. Send a test to confirm delivery."
        : "Webhook URL is saved and alerts are off."
    )
  }

  async function onTest() {
    setError(null)
    setNotice(null)
    if (url.trim() && url.trim() !== prefs.url) {
      setPending("save")
      const saved = await saveMyWebhookUrl(url)
      if (!saved.signedIn) {
        setPending(null)
        onSignedOut()
        return
      }
      applyPrefs(saved)
      if (saved.secretOnce) {
        setSecretOnce(saved.secretOnce)
      }
      if (saved.error) {
        setPending(null)
        setError(saved.error)
        return
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
    setNotice("Test webhook sent. Check Slack or your HTTPS endpoint.")
  }

  async function onRotate() {
    setError(null)
    setNotice(null)
    setPending("rotate")
    const result = await rotateMyWebhookSecret()
    setPending(null)
    if (!result.signedIn) {
      if (result.error) {
        setError(result.error)
        return
      }
      onSignedOut()
      return
    }
    applyPrefs(result)
    setSecretOnce(result.secretOnce)
    setNotice("New signing secret created. Copy it now. The previous secret no longer works.")
  }

  async function onReveal() {
    setError(null)
    setNotice(null)
    setPending("reveal")
    const result = await revealMyWebhookSecret()
    setPending(null)
    if (!result.signedIn) {
      onSignedOut()
      return
    }
    if (!result.secret) {
      setError(result.error || "Could not reveal the signing secret.")
      return
    }
    setSecretOnce(result.secret)
  }

  async function onCopySecret() {
    if (!secretOnce || !navigator.clipboard) {
      return
    }
    try {
      await navigator.clipboard.writeText(secretOnce)
      setNotice("Signing secret copied.")
    } catch {
      setNotice("Select the secret and copy it manually.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook alerts</CardTitle>
        <CardDescription>
          Optional HTTPS POST when a starred service flips Major or Partial.
          Same toggles and mute-until-Live as email, including Slack Incoming
          Webhook URLs.
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
          <Field>
            <FieldLabel htmlFor="webhook-url">Webhook URL</FieldLabel>
            <Input
              id="webhook-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://hooks.slack.com/services/"
              value={url}
              disabled={busy}
              onChange={(event) => {
                setUrl(event.target.value)
              }}
            />
            <FieldDescription>
              Paste a Slack Incoming Webhook URL or any public HTTPS endpoint.
              The URL can stay saved while alerts are off.
            </FieldDescription>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void onSave()
              }}
            >
              {pending === "save" ? "Saving…" : "Save URL"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || (!prefs.url && !url.trim())}
              onClick={() => {
                void onTest()
              }}
            >
              {pending === "test" ? "Sending…" : "Send test"}
            </Button>
          </div>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="webhook-enabled">Enable webhook</FieldLabel>
              <FieldDescription>
                Off keeps the URL saved without posting. Uses the Major and
                Partial toggles above.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="webhook-enabled"
              checked={prefs.enabled}
              disabled={busy}
              onCheckedChange={(checked) => {
                void onToggleEnabled(checked)
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="webhook-secret">Signing secret</FieldLabel>
            <Input
              id="webhook-secret"
              type="text"
              readOnly
              value={secretOnce ?? prefs.secretMasked ?? ""}
              placeholder="Save a URL to create a secret"
              autoComplete="off"
              spellCheck={false}
            />
            <FieldDescription>
              Each POST is signed with HMAC-SHA256 in the X-Statussy-Signature
              header. Shown in full after create, rotate, or reveal.
            </FieldDescription>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !prefs.hasSecret}
              onClick={() => {
                void onReveal()
              }}
            >
              {pending === "reveal" ? "Revealing…" : "Reveal secret"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !secretOnce}
              onClick={() => {
                void onCopySecret()
              }}
            >
              Copy secret
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !prefs.hasSecret}
              onClick={() => {
                void onRotate()
              }}
            >
              {pending === "rotate" ? "Rotating…" : "Rotate secret"}
            </Button>
          </div>
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              How to create a Slack Incoming Webhook
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                In Slack, open Apps and add Incoming WebHooks, or open your
                app at api.slack.com/apps and enable Incoming Webhooks.
              </li>
              <li>Add the webhook to a workspace and pick a channel.</li>
              <li>
                Copy the URL starting with
                https://hooks.slack.com/services/ and paste it here.
              </li>
              <li>Save the URL, turn on Enable webhook, then Send test.</li>
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
