/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // Only use internal proxy in development or when NEXT_PUBLIC_API_URL is not set
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    
    // Skip rewrites if we're using an external API URL (reverse proxy scenario)
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_API_URL) {
      return []
    }
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig