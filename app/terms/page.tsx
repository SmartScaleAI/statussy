import type { Metadata } from "next"

import {
  ContactEmail,
  LegalDocument,
  LegalP,
  LegalSection,
} from "@/components/legal-document"

export const metadata: Metadata = {
  title: "Terms of Service · Statussy",
  description:
    "Terms of Service for Statussy, operated by SmartScale Solutions LLC.",
}

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service — Statussy">
      <LegalP>
        By using Statussy (the “Service”), you agree to these Terms.
      </LegalP>

      <LegalSection title="The Service">
        <LegalP>
          Statussy displays aggregated status information about third-party
          services and optional signed-in features (e.g. My Stack). Status data
          comes from third parties and may be delayed, incomplete, or wrong.{" "}
          <strong>
            Do not rely on Statussy as the sole source for incident response or
            SLA decisions.
          </strong>
        </LegalP>
      </LegalSection>

      <LegalSection title="Accounts">
        <LegalP>
          You may sign in with email magic link, Google, or GitHub. You are
          responsible for activity under your account. Keep your email and
          linked OAuth accounts secure.
        </LegalP>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <LegalP>
          Do not abuse the Service (scraping that harms us or providers,
          attempts to break auth/security, illegal use, or impersonation). We
          may suspend access for abuse.
        </LegalP>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <LegalP>
          Statussy branding, UI, and our software are owned by SmartScale
          Solutions LLC or its licensors. Third-party names/logos belong to
          their owners and are used for identification of status sources.
        </LegalP>
      </LegalSection>

      <LegalSection title="Disclaimer">
        <LegalP>
          THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND,
          EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant
          uninterrupted or error-free operation or accuracy of third-party
          status data.
        </LegalP>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <LegalP>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SMARTSCALE SOLUTIONS LLC WILL
          NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES, OR LOST PROFITS/DATA, ARISING FROM YOUR USE OF THE
          SERVICE.
        </LegalP>
      </LegalSection>

      <LegalSection title="Changes / termination">
        <LegalP>
          We may change or discontinue the Service or these Terms. Continued use
          after changes means you accept them. We may terminate access for
          breach of these Terms.
        </LegalP>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalP>
          SmartScale Solutions LLC — Statussy: <ContactEmail />.
        </LegalP>
      </LegalSection>
    </LegalDocument>
  )
}
