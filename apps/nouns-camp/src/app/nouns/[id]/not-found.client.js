"use client";

import { useParams } from "next/navigation";
import ClientAppProvider from "@/app/client-app-provider";
import ErrorScreen from "@/components/error-screen";

export default function NotFound() {
  const params = useParams();

  return (
    <ClientAppProvider>
      <ErrorScreen
        title="Not found"
        description={`Noun "${params.id}" does not exist.`}
        imageSrc="https://media1.tenor.com/m/3hjyPqYx4pEAAAAC/nouns-nounsdao.gif"
        linkHref="/auction"
        linkLabel="Back to safety"
      />
    </ClientAppProvider>
  );
}
