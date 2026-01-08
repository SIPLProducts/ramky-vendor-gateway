import { Button } from '@/components/ui/button';
import { Loader2, Save, X, ChevronRight, ChevronLeft, Send } from 'lucide-react';

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
}: StickyActionBarProps) {
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 1;

  return (
    <div className="sticky-footer">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Left side - Cancel */}
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>

        {/* Right side - Navigation and Actions */}
        <div className="flex items-center gap-3">
          {/* Save as Draft */}
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={isSaving}
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
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Application
            </Button>
          ) : (
            <Button
              type="submit"
              form="step-form"
              className="min-w-[100px]"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
