import { Link } from 'react-router-dom';
import { HelpCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ramkyLogo from '@/assets/ramky-logo-transparent.png';

export function PublicHeader() {
  return (
    <header className="h-16 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-50">
      <h1 className="text-base font-bold text-foreground">Ramky Vypaar Portal</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/support">
            <HelpCircle className="h-4 w-4 mr-2" />
            Help
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/feedback">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
          </Link>
        </Button>
        <div className="bg-card rounded-md p-1 ml-1">
          <img src={ramkyLogo} alt="Ramky Vypaar Portal" className="h-10 w-auto object-contain" />
        </div>
      </div>
    </header>
  );
}