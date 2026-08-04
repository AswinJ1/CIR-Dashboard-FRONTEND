import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// export function url: string | null | undefined: string | null {
//   if (!url) return null
//   if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url
//   const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
//   let backendOrigin = "http://localhost:3001"
//   try {
//     const parsedUrl = new URL(apiUrl.startsWith('http') ? apiUrl : `http://${apiUrl}`)
//     backendOrigin = parsedUrl.origin
//   } catch (e) {
//     console.error("Failed to parse backend origin", e)
//   }
//   // Ensure we don't double slash if url starts with slash
//   const cleanUrl = url.startsWith('/') ? url : `/${url}`
//   return `${backendOrigin}${cleanUrl}`
// }
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(/<br\s*[\/]?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}
