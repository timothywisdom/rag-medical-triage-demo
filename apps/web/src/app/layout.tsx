import type { ReactNode } from "react";

export const metadata = {
  title: "Maple follow-up",
  description: "Ask a follow-up question about your virtual visit",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, serif", margin: 0, background: "#f7f4ef", color: "#1c1917" }}>
        {children}
      </body>
    </html>
  );
}
