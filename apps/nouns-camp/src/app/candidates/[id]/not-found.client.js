"use client";

import { isAddress } from "viem";
import { useParams } from "next/navigation";
import ClientAppProvider from "../../client-app-provider.js";
import { normalizeId, extractSlugFromId } from "../../../utils/candidates.js";
import AccountPreviewPopoverTrigger from "../../../components/account-preview-popover-trigger.js";
import ErrorScreen from "../../../components/error-screen.js";

export default function NotFound() {
  const params = useParams();
  const candidateId = normalizeId(params.id);
  const slug = extractSlugFromId(candidateId);
  const proposerId = candidateId.split("-")[0];

  return (
    <ClientAppProvider>
      <ErrorScreen
        title="Not found"
        description={
          isAddress(proposerId) ? (
            <>
              {`Found no candidate "${slug}" for account`}{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={proposerId}
              />
              .
            </>
          ) : (
            `"${proposerId}" is not a valid account address.`
          )
        }
        imageSrc="https://media1.tenor.com/m/3hjyPqYx4pEAAAAC/nouns-nounsdao.gif"
        linkHref="/?tab=candidates"
        linkLabel="Browse candidates"
        navigationStack={[
          { to: "/?tab=candidates", label: "Candidates", desktopOnly: true },
        ]}
      />
    </ClientAppProvider>
  );
}
