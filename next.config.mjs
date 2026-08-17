/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Listing photos live in the `listing-photos` bucket on Supabase Storage. next/image
    // refuses any host that is not listed here, so without this every photo 400s.
    // Hostname is derived rather than hard-coded so a project move needs no code change.
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jpufhxzvqfrdcblfmrmu.supabase.co"
        ).hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
