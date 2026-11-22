import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "LeakLedger · Ward operations",
  description: "Review water leak reports and track ward repairs.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
