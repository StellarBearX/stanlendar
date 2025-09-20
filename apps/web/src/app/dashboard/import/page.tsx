import { Metadata } from 'next'
import ImportWizard from '@/components/import/ImportWizard'

export const metadata: Metadata = {
  title: 'Import Schedule - Class Schedule Sync',
  description: 'Import your class schedule from CSV or XLSX files',
}

export default function ImportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Import Schedule</h1>
            <p className="mt-2 text-sm text-gray-600">
              Upload your class schedule from a CSV or XLSX file
            </p>
          </div>
          <ImportWizard />
        </div>
      </div>
    </div>
  )
}