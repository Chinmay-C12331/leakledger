import type { Metadata } from "next";
import TrackView from "./TrackView";
export const metadata: Metadata = {
  title: "Repair status · LeakLedger",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TrackView token={token} />;
}
