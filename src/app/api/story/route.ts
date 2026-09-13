const retired = () =>
  Response.json(
    {
      error:
        "Event-only stories have been retired. Use saved investigations and reproducible exports.",
    },
    { status: 410 },
  );
export const GET = retired;
export const POST = retired;
