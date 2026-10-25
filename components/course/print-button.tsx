'use client'

/**
 * Print, which every browser also offers as "Save as PDF". That covers both
 * the agent who wants it on paper and the one who wants a file, without the
 * site having to make PDFs.
 */
export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-ink px-4 py-2 text-sm text-page transition-opacity hover:opacity-90 print:hidden"
    >
      {label}
    </button>
  )
}
