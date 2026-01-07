import { Link } from 'react-router-dom';
import { HelpCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PublicHeader() {
  return (
    <header className="h-14 border-b bg-card/80 backdrop-blur-lg px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-md shadow-primary/20">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Ramky Vendor Portal</h1>
          </div>
        </div>
      </div>
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
      </div>
    </header>
  );
}