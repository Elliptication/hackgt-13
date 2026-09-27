import Footer from '@/components/Footer'
import { Header } from '@/components/Header/Header'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="relative w-full pt-14">
        <main id="main" tabIndex={-1} className="relative min-h-screen scroll-mt-14 outline-hidden">
          {children}
        </main>
      </div>
      <Footer />
    </>
  )
}
