import { Link } from 'react-router-dom';
import { HelpCircle, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ramkyLogo from '@/assets/ramky-logo.png';

interface EnterpriseHeaderProps {
  showHelp?: boolean;
}

export function EnterpriseHeader({ showHelp = true }: EnterpriseHeaderProps) {
  return (
    <header className="h-12 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-50 shadow-enterprise-sm">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-3">
          <img 
            src={ramkyLogo} 
            alt="Ramky" 
            className="h-8 w-auto"
          />
          <div className="hidden sm:block">
            <span className="text-sm font-semibold text-foreground">Vendor Portal</span>
          </div>
        </Link>
      </div>
      
      {showHelp && (
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Help & Support</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Need Assistance?</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/support" className="flex items-center gap-2 cursor-pointer">
                  <HelpCircle className="h-4 w-4" />
                  Help Center & FAQs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>vendor.support@ramky.com</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>+91 40 2354 6789</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/feedback" className="cursor-pointer">
                  Share Feedback
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
}
