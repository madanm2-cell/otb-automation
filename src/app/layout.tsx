import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AuthProvider } from "@/components/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "TMRW OTB Platform",
  description: "TMRW Open-To-Buy inventory planning platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <AuthProvider>
            <AppLayout>{children}</AppLayout>
          </AuthProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
