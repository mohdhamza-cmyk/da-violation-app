'use client'
import { useRef, useState } from 'react'
import { Upload, Download, CheckCircle, AlertCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface BulkUploadProps {
  label: string
  templateHeaders: string[]
  templateExample: Record<string, string>[]
  onUpload: (rows: Record<string, string>[]) => Promise<{ success: number; errors: string[] }>
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] ?? '').trim().replace(/^"|"$/g, '')
    })
    return row
  })
}

function toCSV(headers: string[], rows: Record<string, string>[]): string {
  const escape = (v: string) => v.includes(',') ? `"${v}"` : v
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h] ?? '')).join(','))
  ].join('\n')
}

export default function BulkUpload({ label, templateHeaders, templateExample, onUpload }: BulkUploadProps) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function downloadTemplate() {
    const csv = toCSV(templateHeaders, templateExample)
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${label.toLowerCase().replace(/\s+/g, '-')}-template.csv`
    a.click()
    toast.success('Template downloaded')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setResult(null)
    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) {
      toast.error('No data rows found in CSV')
      setUploading(false)
      return
    }
    const res = await onUpload(rows)
    setResult(res)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if (res.success > 0) toast.success(`${res.success} ${label} imported`)
    if (res.errors.length > 0) toast.error(`${res.errors.length} rows failed`)
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setResult(null) }}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <Upload className="w-4 h-4" />
        Bulk Upload
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Bulk Upload — {label}</h2>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              Download the template, fill it in, then upload the CSV file.
            </div>

            <button onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Download className="w-5 h-5" />
              <span className="font-medium">Download CSV Template</span>
            </button>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Upload filled CSV</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFile}
                disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Importing rows…
              </div>
            )}

            {result && (
              <div className="space-y-2">
                {result.success > 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <CheckCircle className="w-4 h-4" />
                    {result.success} rows imported successfully
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertCircle className="w-4 h-4" />
                      {result.errors.length} rows failed:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                      {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                      {result.errors.length > 10 && <li>…and {result.errors.length - 10} more</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
