import { Button } from '@/components/ui/button';
import { Loader2, Save, X, ChevronRight, ChevronLeft, Send, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StickyActionBarProps {
  currentStep: number;
  totalSteps: number;
  onCancel: () => void;
  onSaveDraft: () => void;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isSaving?: boolean;
  isSubmitting?: boolean;
  canSubmit?: boolean;
  canProceed?: boolean;
  validationMessage?: string;
}

export function StickyActionBar({
  currentStep,
  totalSteps,
  onCancel,
  onSaveDraft,
  onBack,
  onNext,
  onSubmit,
  isSaving = false,
  isSubmitting = false,
  canSubmit = true,
  canProceed = true,
  validationMessage,
}: StickyActionBarProps) {
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 1;




  return (
    <div className="sticky-footer">
      <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        {/* Mobile-only inline validation message (desktop shows a centered pill) */}
        {!canProceed && validationMessage && (
          <div className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning-foreground rounded-md border border-warning/30 text-xs">
            <ShieldAlert className="h-3.5 w-3.5 text-warning shrink-0" />
            <span className="font-medium">{validationMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-between md:justify-start gap-2 md:gap-3 w-full md:w-auto">
          {/* Left side - Cancel */}
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            size="sm"
            className="text-muted-foreground hover:text-foreground md:size-default"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          {/* Center - Validation Message (desktop only) */}
          {!canProceed && validationMessage && (
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-warning/10 text-warning-foreground rounded-lg border border-warning/30">
              <ShieldAlert className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium">{validationMessage}</span>
            </div>
          )}
        </div>

        {/* Right side - Navigation and Actions */}
        <div className="grid grid-cols-2 md:flex md:items-center gap-2 md:gap-3 w-full md:w-auto">
          {/* Save as Draft */}
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={isSaving}
            className="w-full md:w-auto"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Draft
          </Button>

          {/* Back Button */}
          {!isFirstStep && onBack && (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="w-full md:w-auto"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
          )}

          {/* Next / Submit Button */}
          {isLastStep ? (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || !canSubmit}
              className="col-span-2 md:col-span-1 md:min-w-[160px] w-full md:w-auto"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Application
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={!canProceed ? 0 : undefined} className={cn(!isFirstStep ? '' : 'col-span-1', 'w-full md:w-auto')}>
                    <Button
                      type="submit"
                      form={currentStep === 1 ? "step-form-1" : currentStep === 2 ? "step-form-2" : "step-form"}
                      disabled={!canProceed}
                      className={cn(
                        "w-full md:min-w-[120px]",
                        !canProceed && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canProceed && validationMessage && (
                  <TooltipContent side="top" className="max-w-xs">
                    <p>{validationMessage}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}
