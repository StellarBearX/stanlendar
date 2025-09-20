import ProtectedRoute from '@/components/auth/ProtectedRoute'
import DashboardNav from '@/components/layout/DashboardNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="dashboard-layout">
        <DashboardNav />
        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}