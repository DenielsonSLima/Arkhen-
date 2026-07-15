export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
  cors = true,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(cors ? corsHeaders : {}),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
