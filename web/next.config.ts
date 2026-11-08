import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// This machine's local network addresses, so a phone on the same Wi-Fi can load the dev
// server (`npm run dev:phone`). Only affects development.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i !== undefined && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: lanAddresses,
};

export default nextConfig;
