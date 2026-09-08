import type { Metadata } from "next"

import {
  ContactEmail,
  LegalDocument,
  LegalList,
  LegalP,
  LegalSection,
} from "@/components/legal-document"

export const metadata: Metadata = {
  title: "Privacy Policy · Statussy",
  description:
    "How Statussy collects, uses, and shares account, favorites, and technical data.",
}

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy — Statussy">
      <LegalP>
        Statussy is a status-board product that shows third-party service health
        and lets you sign in to save <strong>My Stack</strong> favorites.
      </LegalP>

      <LegalSection title="Information we collect">
        <LegalList>
          <li>
            <strong>Account data</strong> when you sign in: email address and
            basic profile details from the provider you choose (
            <strong>email magic link</strong> via Resend,{" "}
            <strong>Google</strong>, or <strong>GitHub</strong>), plus session
            tokens we create to keep you signed in.
          </li>
          <li>
            <strong>My Stack favorites</strong>: the service IDs you star,
            stored in our database and tied to your account when you are signed
            in.
          </li>
          <li>
            <strong>Technical data</strong>: standard server/logs needed to run
            the site (e.g. IP, user agent, error logs). We do not sell personal
            data.
          </li>
        </LegalList>
        <LegalP>
          Anonymous browsing of the public board does not require an account.
          Signed-out users cannot save favorites (sign-in is required to star).
        </LegalP>
      </LegalSection>

      <LegalSection title="How we use Google / GitHub user data">
        <LegalP>
          If you sign in with Google or GitHub, we use the OAuth data only to{" "}
          <strong>authenticate you</strong>, create/maintain your Statussy
          account/session, and show your email in the signed-in UI. We do{" "}
          <strong>not</strong> use Google or GitHub data for advertising, and we
          do not sell it. Access is limited to what those providers return for
          sign-in (typically email and basic profile).
        </LegalP>
      </LegalSection>

      <LegalSection title="Where data lives">
        <LegalP>
          Account, session, and favorites data are stored in our hosted Postgres
          database (Railway). The web app is hosted on Vercel. Magic-link email
          is sent through Resend.
        </LegalP>
      </LegalSection>

      <LegalSection title="Sharing">
        <LegalP>
          We share data only with processors needed to operate Statussy
          (hosting, database, email, OAuth providers) under their terms, or if
          required by law.
        </LegalP>
      </LegalSection>

      <LegalSection title="Retention">
        <LegalP>
          We keep account and favorites data while your account exists. You can
          request deletion by contacting us (see Contact). Sessions expire per
          our auth configuration.
        </LegalP>
      </LegalSection>

      <LegalSection title="Your choices">
        <LegalP>
          Sign out anytime. Stop using OAuth by disconnecting Statussy in
          Google/GitHub account settings and/or contacting us to delete your
          Statussy account data.
        </LegalP>
      </LegalSection>

      <LegalSection title="Children">
        <LegalP>
          Statussy is not directed at children under 13. We do not knowingly
          collect their data.
        </LegalP>
      </LegalSection>

      <LegalSection title="Changes">
        <LegalP>
          We may update this policy; the effective date above will change.
          Continued use after an update means you accept the revised policy.
        </LegalP>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalP>
          SmartScale Solutions LLC — privacy / account requests for Statussy:{" "}
          <ContactEmail />.
        </LegalP>
      </LegalSection>
    </LegalDocument>
  )
}
