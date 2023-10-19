export const config = {
  runtime: "edge",
};

export default async (req) => {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (address == null)
    return new Response(JSON.stringify({ code: "address-required" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    });

  return new Response(JSON.stringify({ data: { status: "ok" } }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
