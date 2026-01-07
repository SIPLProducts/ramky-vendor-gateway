import { Clock } from 'lucide-react';

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
    </header>
  );
}