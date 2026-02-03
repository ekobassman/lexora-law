export default function handler(req: any, res: any) {
  res.setHeader("content-type", "application/json");
  res.status(200).send(
    JSON.stringify({
      ok: true,
      runtime: "node",
      now: new Date().toISOString()
    })
  );
}
