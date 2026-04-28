import type { Metadata } from "next";
import { ConfigProvider } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AuthProvider } from "@/components/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import { BrandProvider } from "@/contexts/BrandContext";
import { antdTheme } from "@/lib/antdTheme";
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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AntdRegistry>
          <ConfigProvider theme={antdTheme}>
            <AuthProvider>
              <BrandProvider>
                <AppLayout>{children}</AppLayout>
              </BrandProvider>
            </AuthProvider>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
