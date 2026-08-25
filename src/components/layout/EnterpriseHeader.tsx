import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TenantCombobox } from '@/components/admin/TenantCombobox';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useAuth } from '@/hooks/useAuth';
import ramkyLogo from '@/assets/ramky-logo-transparent.png';

interface EnterpriseHeaderProps {
  showHelp?: boolean;
}

export function EnterpriseHeader({ showHelp = true }: EnterpriseHeaderProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const {
    myTenants, activeTenantId, setActiveTenantId,
    activeTenantIds, setActiveTenantIds,
    isSuperAdmin, isCrossTenantReviewer, isScmManager, isStageApprover, isBuyerRole,
  } = useTenantContext();
  const hidePicker = isCrossTenantReviewer || isScmManager || isStageApprover;
  const showSwitcher = !hidePicker && (myTenants.length > 1 || (isSuperAdmin && myTenants.length > 0));

  // Clear any pinned tenant for roles that should always see all data.
  useEffect(() => {
    if (hidePicker && activeTenantId !== null) setActiveTenantId(null);
  }, [hidePicker, activeTenantId, setActiveTenantId]);


  return (
    <header className="h-14 border-b bg-card/80 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-enterprise-sm">
      <Link to="/" className="flex items-center">
        <span className="text-lg font-semibold text-foreground tracking-wide whitespace-nowrap">Vyapaar Portal</span>
      </Link>

      <div className="flex items-center gap-2">

        {showSwitcher && (
          isBuyerRole ? (
            <TenantCombobox
              tenants={myTenants}
              multi
              values={activeTenantIds}
              onChangeMulti={(ids) => setActiveTenantIds(ids)}
              allowAll
              allLabel="All Tenants"
              className="w-[220px]"
              triggerClassName="h-8 text-xs"
            />
          ) : (
            <TenantCombobox
              tenants={myTenants}
              value={activeTenantId}
              onChange={(id) => setActiveTenantId(id)}
              allowAll
              allLabel="All Tenants"
              className="w-[200px]"
              triggerClassName="h-8 text-xs"
            />
          )
        )}
        {showHelp && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try { await signOut(); } finally { navigate('/auth', { replace: true }); }
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Logout</TooltipContent>
          </Tooltip>
        )}
        <img src={ramkyLogo} alt="Ramky" className="h-9 w-auto object-contain" />
      </div>
    </header>
  );
}
