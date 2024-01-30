"use client";

import { css } from "@emotion/react";
import { useParams } from "next/navigation";
import ClientAppProvider from "../../client-app-provider.js";
import ErrorScreen from "../../../components/error-screen.js";

export default function NotFound() {
  const { id } = useParams();

  return (
    <ClientAppProvider>
      <ErrorScreen
        title="Not found"
        description={
          <>
            Found no proposal with id{" "}
            <span css={(t) => css({ fontWeight: t.text.weights.emphasis })}>
              {'"'}
              {id}
              {'"'}
            </span>
            .
          </>
        }
        imageSrc="https://media1.tenor.com/m/3hjyPqYx4pEAAAAC/nouns-nounsdao.gif"
        linkHref="/?tab=proposals"
        linkLabel="Browse proposals"
        navigationStack={[
          { to: "/?tab=proposals", label: "Proposals", desktopOnly: true },
        ]}
      />
    </ClientAppProvider>
  );
}
