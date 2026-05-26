import { ReactNode, useState } from 'react';
import { Menu } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full">
      {/* 데스크탑 사이드바 */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>

      {/* 모바일 사이드바 (드로어) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <AppSidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 모바일 상단바 */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileNavOpen(true)}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <img src={logo} alt="업도움" className="h-8 w-8 object-contain" />
          <span className="text-base font-bold">업도움</span>
        </header>

        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
