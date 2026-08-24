import { Link } from 'react-router-dom';
import { HelpCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ramkyLogoAsset from '@/assets/ramky-group-logo.jpg.asset.json';
const ramkyLogo = ramkyLogoAsset.url;

export function PublicHeader() {
  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4 order-last">
        <div className="flex items-center gap-3 flex-row-reverse">
          <img src={ramkyLogo} alt="Ramky Vypaar Portal" className="h-10 w-auto object-contain" />
          <div>
            <h1 className="text-base font-bold text-black">Ramky Vypaar Portal</h1>
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